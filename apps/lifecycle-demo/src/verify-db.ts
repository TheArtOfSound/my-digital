import {
  bytesEqual,
  importIssuerPublicKey,
  sha256Hex,
  verifyBuyerLicense,
  verifyProofReceipt,
  verifyUnlockCode
} from "@my-digital/core";
import { DemoEnvelopeAdapter } from "@my-digital/envelope";
import { openSqliteStore } from "@my-digital/store";
import type { VerificationResult } from "@my-digital/types";
import { existsSync } from "node:fs";
import { defaultDbPath } from "./db-path";

const dbPath = defaultDbPath();
const rawCodeArg = process.argv[2];

console.log("=".repeat(74));
console.log("My Digital demo database verification (fresh process)");
console.log(`Database: ${dbPath}`);
console.log("Every record below was written by a previous process. This command");
console.log("re-verifies licenses, receipts, and envelope integrity from disk.");
console.log("=".repeat(74));

if (!existsSync(dbPath)) {
  console.error(`\nNo database found at ${dbPath}. Run \`pnpm db:seed\` first.`);
  process.exit(1);
}

const store = openSqliteStore({ path: dbPath });
const adapter = new DemoEnvelopeAdapter();

function report(name: string, verification: VerificationResult, expected: "ok" | "fail"): boolean {
  const okStatus =
    expected === "fail" ? verification.status === "fail" : verification.status !== "fail";
  const failed = verification.checksFailed.map((check) => check.code).join(", ");
  console.log(
    `  ${okStatus ? "ok " : "BAD"} ${name.padEnd(26)} status=${verification.status.padEnd(7)} ` +
      `passed=${verification.checksPassed.length} failed=${verification.checksFailed.length}` +
      `${failed.length > 0 ? `  [${failed}]` : ""}`
  );
  return okStatus;
}

const issuer = await store.getIssuer("my-digital-demo-issuer");
if (!issuer) {
  console.error("\nNo issuer record found. Run `pnpm db:seed` first.");
  process.exit(1);
}
const issuerPublicKey = await importIssuerPublicKey(issuer.publicKeyB64);
console.log(`\nIssuer: ${issuer.name} (public key loaded from database)`);

const licenses = await store.listLicenses();
if (licenses.length === 0) {
  console.error("\nNo licenses found. Run `pnpm db:seed` first.");
  process.exit(1);
}

let allOk = true;
console.log(`\nVerifying ${licenses.length} license(s):`);

for (const license of licenses) {
  const asset = await store.getAsset(license.assetId);
  const assetVersion = await store.getAssetVersion(license.assetVersionId);
  const lockedAsset = await store.getLockedAsset(license.lockedAssetId);
  const payload = await store.getLockedPayload(license.lockedAssetId);
  if (!asset || !assetVersion || !lockedAsset || !payload) {
    console.error(`  BAD ${license.id}: related records are missing from the database.`);
    allOk = false;
    continue;
  }

  const licenseVerification = await verifyBuyerLicense({
    license,
    issuerPublicKey,
    expected: {
      assetId: asset.id,
      assetVersionId: assetVersion.id,
      lockedAssetId: lockedAsset.id,
      buyerId: license.buyerId
    }
  });
  allOk = report("license", licenseVerification, "ok") && allOk;

  const envelopeVerification = await adapter.verify({
    lockedAssetId: lockedAsset.id,
    expectedLockedPayloadHash: lockedAsset.lockedPayloadHash,
    actualLockedPayloadHash: await sha256Hex(payload),
    expectedMetadataHash: lockedAsset.metadataHash,
    actualMetadataHash: lockedAsset.metadataHash
  });
  allOk = report("locked envelope", envelopeVerification, "ok") && allOk;

  const tampered = new Uint8Array(payload);
  tampered[0] = (tampered[0] ?? 0) ^ 0xff;
  const tamperVerification = await adapter.verify({
    lockedAssetId: lockedAsset.id,
    expectedLockedPayloadHash: lockedAsset.lockedPayloadHash,
    actualLockedPayloadHash: await sha256Hex(tampered)
  });
  allOk = report("tampered copy (must fail)", tamperVerification, "fail") && allOk;

  const unlockCode = await store.getUnlockCodeByLicense(license.id);
  if (rawCodeArg !== undefined && unlockCode) {
    const codeVerification = await verifyUnlockCode({ rawCode: rawCodeArg, unlockCode });
    allOk = report("unlock code", codeVerification, "ok") && allOk;
    if (codeVerification.status !== "fail") {
      const unlockResult = await adapter.unlock({
        lockedPayload: payload,
        licenseMaterial: rawCodeArg
      });
      const contentMatches =
        (await sha256Hex(unlockResult.plaintext)) === assetVersion.contentHash &&
        unlockResult.plaintext.byteLength === assetVersion.byteSize &&
        !bytesEqual(unlockResult.plaintext, new Uint8Array());
      console.log(
        `  ${contentMatches ? "ok " : "BAD"} ${"unlocked plaintext".padEnd(26)} ` +
          `${unlockResult.plaintext.byteLength} bytes, SHA-256 ${
            contentMatches ? "matches" : "does NOT match"
          } recorded content hash`
      );
      allOk = contentMatches && allOk;
    }
  } else {
    console.log(
      "  --  unlock code              not checked (pass the raw code as an argument to verify it)"
    );
  }
}

const receipts = await store.listProofReceipts();
console.log(`\nVerifying ${receipts.length} receipt(s):`);
for (const receipt of receipts) {
  const receiptVerification = await verifyProofReceipt({
    receipt,
    issuerPublicKey,
    expected: { purchaseId: receipt.purchaseId, licenseId: receipt.licenseId }
  });
  allOk = report("proof receipt", receiptVerification, "ok") && allOk;
}

await store.close();

if (!allOk) {
  console.error("\nSome verifications did not behave as expected.");
  process.exit(1);
}
console.log("\nAll database records verified as expected in a fresh process.");
