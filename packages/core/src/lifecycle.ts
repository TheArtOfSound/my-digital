import type {
  Asset,
  AssetManifest,
  AssetVersion,
  Buyer,
  BuyerLicense,
  Creator,
  EnvelopeAdapter,
  LicenseTerms,
  Listing,
  LockedAsset,
  ProofReceipt,
  Purchase,
  UnlockCode,
  VerificationResult
} from "@my-digital/types";
import { bytesEqual, utf8Bytes } from "./encoding";
import {
  createAsset,
  createAssetVersion,
  createBuyer,
  createCreator,
  createListing,
  createLockedAssetRecord,
  demoPersonalLicenseTerms,
  simulatePaidPurchase
} from "./entities";
import { sha256Hex } from "./hash";
import { issueBuyerLicense, verifyBuyerLicense } from "./licenses";
import { generateProofReceipt, verifyProofReceipt } from "./receipts";
import { generateIssuerSigningKeys } from "./signing";
import { issueUnlockCode, redeemUnlockCode, verifyUnlockCode } from "./unlock-codes";

export interface LifecycleStep {
  step: number;
  label: string;
  ok: boolean;
  detail: string;
}

export interface LifecycleDemoOptions {
  creator?: { displayName: string; handle: string; email: string };
  buyer?: { email: string; displayName?: string };
  asset?: { title: string; description: string; category: string };
  versionLabel?: string;
  fileName?: string;
  mimeType?: string;
  payload?: Uint8Array;
  priceAmount?: number;
  priceCurrency?: string;
  licenseTerms?: LicenseTerms;
  issuerName?: string;
  verificationUrlBase?: string;
}

export interface LifecycleDemoResult {
  demoOnly: true;
  issuer: { name: string; publicKeyB64: string };
  creator: Creator;
  buyer: Buyer;
  asset: Asset;
  assetVersion: AssetVersion;
  manifest: AssetManifest;
  lockedAsset: LockedAsset;
  lockedPayload: Uint8Array;
  listing: Listing;
  purchase: Purchase;
  license: BuyerLicense;
  unlockCode: UnlockCode;
  rawUnlockCode: string;
  receipt: ProofReceipt;
  unlockedPayload: Uint8Array;
  verifications: {
    license: VerificationResult;
    unlockCode: VerificationResult;
    envelope: VerificationResult;
    unlock: VerificationResult;
    receipt: VerificationResult;
    tamperedEnvelope: VerificationResult;
  };
  steps: LifecycleStep[];
}

/**
 * Runs the full CREATE -> LOCK -> LIST -> BUY -> LICENSE -> UNLOCK -> VERIFY
 * -> TRACE-precursor loop locally against the supplied envelope adapter.
 * With the demo adapter this proves lifecycle wiring, not production security.
 */
export async function runLifecycleDemo(
  adapter: EnvelopeAdapter,
  options: LifecycleDemoOptions = {}
): Promise<LifecycleDemoResult> {
  const steps: LifecycleStep[] = [];
  const note = (step: number, label: string, ok: boolean, detail: string): void => {
    steps.push({ step, label, ok, detail });
  };

  const issuerName = options.issuerName ?? "my-digital-demo-issuer";
  const issuerKeys = await generateIssuerSigningKeys(issuerName);

  const creator = await createCreator(
    options.creator ?? {
      displayName: "Demo Creator",
      handle: "demo-creator",
      email: "creator@example.com"
    }
  );
  note(1, "create creator", true, creator.id);

  const buyer = await createBuyer(
    options.buyer ?? { email: "buyer@example.com", displayName: "Demo Buyer" }
  );
  note(2, "create buyer", true, buyer.id);

  const payload =
    options.payload ??
    utf8Bytes(
      "My Digital demo product payload. This plaintext exists to prove the lock/license/unlock/verify loop."
    );
  if (payload.byteLength === 0) {
    throw new Error("Lifecycle demo payload must not be empty.");
  }
  let asset = createAsset({
    creatorId: creator.id,
    ...(options.asset ?? {
      title: "Demo Asset",
      description: "A demo digital product for lifecycle testing.",
      category: "demo"
    })
  });
  note(3, "create asset bytes", true, `${asset.id} (${payload.byteLength} bytes)`);

  const { assetVersion, manifest } = await createAssetVersion({
    asset,
    versionLabel: options.versionLabel ?? "1.0.0",
    fileName: options.fileName ?? "demo-asset.txt",
    mimeType: options.mimeType ?? "text/plain",
    bytes: payload
  });
  note(4, "create asset manifest", true, `${assetVersion.id} manifestHash=${assetVersion.manifestHash.slice(0, 16)}…`);

  const lockResult = await adapter.lock({
    assetVersionId: assetVersion.id,
    fileName: assetVersion.fileName,
    mimeType: assetVersion.mimeType,
    plaintext: payload
  });
  const lockedAsset = createLockedAssetRecord({
    assetVersionId: assetVersion.id,
    lockResult
  });
  asset = { ...asset, status: "locked" };
  note(
    5,
    "lock asset via envelope adapter",
    true,
    `${lockedAsset.id} format=${lockedAsset.envelopeFormat}${lockResult.developmentOnly ? " [DEMO ONLY]" : ""}`
  );

  const listing = createListing({
    asset,
    activeAssetVersionId: assetVersion.id,
    priceAmount: options.priceAmount ?? 1900,
    priceCurrency: options.priceCurrency ?? "USD",
    licenseTerms: options.licenseTerms ?? demoPersonalLicenseTerms
  });
  asset = { ...asset, status: "listed" };
  note(6, "create listing", true, `${listing.id} ${listing.priceAmount} ${listing.priceCurrency}`);

  const purchase = simulatePaidPurchase({ listing, buyer });
  note(7, "simulate paid purchase (mock provider)", true, `${purchase.id} status=${purchase.status}`);

  const license = await issueBuyerLicense({
    purchase,
    buyer,
    asset,
    assetVersion,
    lockedAsset,
    terms: listing.licenseTerms,
    issuer: issuerName,
    issuerPrivateKey: issuerKeys.privateKey
  });
  note(8, "issue buyer-specific license", true, license.id);

  const { unlockCode: issuedCode, rawCode } = await issueUnlockCode({ licenseId: license.id });
  note(9, "issue unlock code", true, `${issuedCode.id} (raw code withheld from records; only its hash is stored)`);

  const licenseVerification = await verifyBuyerLicense({
    license,
    issuerPublicKey: issuerKeys.publicKey,
    expected: {
      assetId: asset.id,
      assetVersionId: assetVersion.id,
      lockedAssetId: lockedAsset.id,
      buyerId: buyer.id
    }
  });
  const codeVerification = await verifyUnlockCode({ rawCode, unlockCode: issuedCode });
  const envelopeVerification = await adapter.verify({
    lockedAssetId: lockedAsset.id,
    expectedLockedPayloadHash: lockedAsset.lockedPayloadHash,
    actualLockedPayloadHash: await sha256Hex(lockResult.lockedPayload),
    expectedMetadataHash: lockedAsset.metadataHash,
    actualMetadataHash: lockResult.metadataHash
  });
  note(
    10,
    "verify license, unlock code, and envelope against asset records",
    licenseVerification.status !== "fail" &&
      codeVerification.status !== "fail" &&
      envelopeVerification.status !== "fail",
    `license=${licenseVerification.status} code=${codeVerification.status} envelope=${envelopeVerification.status}`
  );

  if (
    licenseVerification.status === "fail" ||
    codeVerification.status === "fail" ||
    envelopeVerification.status === "fail"
  ) {
    throw new Error("Lifecycle demo aborted: verification failed before unlock.");
  }

  const unlockCode = redeemUnlockCode(issuedCode);
  const unlockResult = await adapter.unlock({
    lockedPayload: lockResult.lockedPayload,
    licenseMaterial: rawCode
  });
  const payloadMatches = bytesEqual(unlockResult.plaintext, payload);
  note(
    11,
    "unlock demo payload",
    unlockResult.verification.status !== "fail" && payloadMatches,
    payloadMatches
      ? `unlocked ${unlockResult.plaintext.byteLength} bytes; matches original payload`
      : "unlocked payload does not match original payload"
  );

  const receipt = await generateProofReceipt({
    purchase,
    license,
    creatorId: creator.id,
    issuerPrivateKey: issuerKeys.privateKey,
    verificationUrlBase:
      options.verificationUrlBase ?? "https://mydigital.imagineqira.com/verify"
  });
  const receiptVerification = await verifyProofReceipt({
    receipt,
    issuerPublicKey: issuerKeys.publicKey,
    expected: { purchaseId: purchase.id, licenseId: license.id }
  });
  note(
    12,
    "generate and verify proof receipt",
    receiptVerification.status === "pass",
    `${receipt.id} verification=${receiptVerification.status}`
  );

  const tamperedPayload = new Uint8Array(lockResult.lockedPayload);
  tamperedPayload[0] = (tamperedPayload[0] ?? 0) ^ 0xff;
  const tamperedVerification = await adapter.verify({
    lockedAssetId: lockedAsset.id,
    expectedLockedPayloadHash: lockedAsset.lockedPayloadHash,
    actualLockedPayloadHash: await sha256Hex(tamperedPayload)
  });
  note(
    13,
    "tamper with locked payload and re-verify (failure expected)",
    tamperedVerification.status === "fail",
    `tampered envelope verification=${tamperedVerification.status}`
  );

  return {
    demoOnly: true,
    issuer: { name: issuerName, publicKeyB64: issuerKeys.publicKeyB64 },
    creator,
    buyer,
    asset,
    assetVersion,
    manifest,
    lockedAsset,
    lockedPayload: lockResult.lockedPayload,
    listing,
    purchase,
    license,
    unlockCode,
    rawUnlockCode: rawCode,
    receipt,
    unlockedPayload: unlockResult.plaintext,
    verifications: {
      license: licenseVerification,
      unlockCode: codeVerification,
      envelope: envelopeVerification,
      unlock: unlockResult.verification,
      receipt: receiptVerification,
      tamperedEnvelope: tamperedVerification
    },
    steps
  };
}
