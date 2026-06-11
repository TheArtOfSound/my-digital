import { runLifecycleDemo, utf8Bytes } from "@my-digital/core";
import type { VerificationResult } from "@my-digital/types";
import { DemoEnvelopeAdapter } from "@my-digital/envelope";

function banner(): void {
  console.log("=".repeat(74));
  console.log("My Digital local lifecycle demo");
  console.log("DEMO ONLY - NOT PRODUCTION CRYPTO - FOR LIFECYCLE TESTING");
  console.log("Envelope locking uses the demo adapter. Hashes (SHA-256) and issuer");
  console.log("signatures (Ed25519, ephemeral demo key) are real cryptographic checks.");
  console.log("=".repeat(74));
}

function printVerification(name: string, verification: VerificationResult): void {
  const failed = verification.checksFailed.map((check) => check.code).join(", ");
  console.log(
    `  ${name.padEnd(18)} status=${verification.status.padEnd(7)} ` +
      `passed=${verification.checksPassed.length} failed=${verification.checksFailed.length}` +
      `${verification.checksSkipped.length > 0 ? ` skipped=${verification.checksSkipped.length}` : ""}` +
      `${failed.length > 0 ? `  [${failed}]` : ""}`
  );
}

banner();

const result = await runLifecycleDemo(new DemoEnvelopeAdapter(), {
  payload: utf8Bytes("Demo product: 10 example prompts for testing the QEV commerce lifecycle.")
});

console.log("\nLifecycle steps:");
for (const step of result.steps) {
  console.log(`  ${step.ok ? "ok " : "FAIL"} ${String(step.step).padStart(2)}. ${step.label} — ${step.detail}`);
}

console.log("\nVerification results:");
printVerification("license", result.verifications.license);
printVerification("unlock code", result.verifications.unlockCode);
printVerification("envelope", result.verifications.envelope);
printVerification("unlock", result.verifications.unlock);
printVerification("receipt", result.verifications.receipt);
printVerification("tampered envelope", result.verifications.tamperedEnvelope);

console.log("\nProof receipt:");
console.log(JSON.stringify(result.receipt, null, 2));

console.log("\nIssuer public key (base64, ephemeral demo key):");
console.log(`  ${result.issuer.publicKeyB64}`);

const failedSteps = result.steps.filter((step) => !step.ok);
if (failedSteps.length > 0) {
  console.error(`\n${failedSteps.length} lifecycle step(s) did not behave as expected.`);
  process.exit(1);
}
console.log("\nAll lifecycle steps behaved as expected (including the expected tamper failure).");
