import type {
  AssetId,
  AssetVersionId,
  BuyerId,
  CheckoutSessionId,
  CreatorId,
  FingerprintId,
  LicenseId,
  ListingId,
  LockedAssetId,
  ProofReceiptId,
  PurchaseId,
  RevocationId,
  UnlockCodeId
} from "@my-digital/types";

function prefixedId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const newCreatorId = (): CreatorId => prefixedId("creator") as CreatorId;
export const newBuyerId = (): BuyerId => prefixedId("buyer") as BuyerId;
export const newAssetId = (): AssetId => prefixedId("asset") as AssetId;
export const newAssetVersionId = (): AssetVersionId => prefixedId("assetver") as AssetVersionId;
export const newLockedAssetId = (): LockedAssetId => prefixedId("locked") as LockedAssetId;
export const newListingId = (): ListingId => prefixedId("listing") as ListingId;
export const newPurchaseId = (): PurchaseId => prefixedId("purchase") as PurchaseId;
export const newLicenseId = (): LicenseId => prefixedId("license") as LicenseId;
export const newUnlockCodeId = (): UnlockCodeId => prefixedId("unlock") as UnlockCodeId;
export const newProofReceiptId = (): ProofReceiptId => prefixedId("receipt") as ProofReceiptId;
export const newFingerprintId = (): FingerprintId => prefixedId("fingerprint") as FingerprintId;
export const newRevocationId = (): RevocationId => prefixedId("revocation") as RevocationId;
export const newCheckoutSessionId = (): CheckoutSessionId =>
  prefixedId("checkout") as CheckoutSessionId;
