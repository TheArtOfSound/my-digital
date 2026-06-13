import { runLifecycleDemo } from "@my-digital/core";
import { DemoEnvelopeAdapter } from "@my-digital/envelope";
import { openSqliteStore } from "@my-digital/store/node";
import { defaultDbPath } from "./db-path";

const dbPath = defaultDbPath();

console.log("=".repeat(74));
console.log("My Digital demo database seed");
console.log("DEMO ONLY - NOT PRODUCTION CRYPTO - FOR LIFECYCLE TESTING");
console.log(`Database: ${dbPath}`);
console.log("This command RESETS the demo database, runs the full lifecycle, and");
console.log("persists every record. Only the issuer PUBLIC key is stored.");
console.log("=".repeat(74));

const store = openSqliteStore({ path: dbPath });
await store.reset();

const result = await runLifecycleDemo(new DemoEnvelopeAdapter());

await store.putIssuer({
  name: result.issuer.name,
  publicKeyB64: result.issuer.publicKeyB64,
  createdAt: new Date().toISOString()
});
await store.insertCreator(result.creator);
await store.insertBuyer(result.buyer);
await store.insertAsset(result.asset);
await store.insertAssetVersion(result.assetVersion, result.manifest);
await store.insertLockedAsset(result.lockedAsset);
await store.putLockedPayload(result.lockedAsset.id, result.lockedPayload);
await store.insertListing(result.listing);
await store.insertPurchase(result.purchase);
await store.insertLicense(result.license);
await store.insertUnlockCode(result.unlockCode);
await store.insertProofReceipt(result.receipt);
await store.close();

console.log("\nPersisted records:");
console.log(`  creator        ${result.creator.id}`);
console.log(`  buyer          ${result.buyer.id}`);
console.log(`  asset          ${result.asset.id}`);
console.log(`  asset version  ${result.assetVersion.id}`);
console.log(`  locked asset   ${result.lockedAsset.id} (+ payload blob)`);
console.log(`  listing        ${result.listing.id}`);
console.log(`  purchase       ${result.purchase.id}`);
console.log(`  license        ${result.license.id}`);
console.log(`  unlock code    ${result.unlockCode.id} (hash only)`);
console.log(`  receipt        ${result.receipt.id}`);

console.log("\nRaw unlock code (NOT stored anywhere — copy it now):");
console.log(`  ${result.rawUnlockCode}`);
console.log("\nNext: prove restart survival in a fresh process:");
console.log(`  pnpm db:verify            # verifies license/receipt/envelope from the database`);
console.log(`  pnpm db:verify ${result.rawUnlockCode}   # additionally verifies the code and unlocks`);

const failedSteps = result.steps.filter((step) => !step.ok);
if (failedSteps.length > 0) {
  console.error(`\n${failedSteps.length} lifecycle step(s) did not behave as expected.`);
  process.exit(1);
}
console.log("\nSeed complete.");
