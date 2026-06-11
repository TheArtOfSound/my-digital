import type { CheckoutSessionId, PaymentConfirmation } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import { utf8Bytes } from "./encoding";
import {
  createAsset,
  createAssetVersion,
  createBuyer,
  createCreator,
  createListing,
  createLockedAssetRecord,
  demoPersonalLicenseTerms
} from "./entities";
import { issueBuyerLicense, verifyBuyerLicense } from "./licenses";
import {
  MockPaymentAdapter,
  applyPaymentConfirmation,
  completeMockCheckout,
  createPendingPurchase
} from "./payments";
import { generateIssuerSigningKeys } from "./signing";
import type { EnvelopeLockResult, LockedAssetId } from "@my-digital/types";

async function checkoutFixture() {
  const issuerKeys = await generateIssuerSigningKeys("test-issuer");
  const creator = await createCreator({
    displayName: "Creator",
    handle: "creator",
    email: "creator@example.com"
  });
  const buyer = await createBuyer({ email: "buyer@example.com" });
  const asset = createAsset({
    creatorId: creator.id,
    title: "Asset",
    description: "Payment test asset",
    category: "test"
  });
  const { assetVersion } = await createAssetVersion({
    asset,
    versionLabel: "1.0.0",
    fileName: "asset.txt",
    mimeType: "text/plain",
    bytes: utf8Bytes("asset content")
  });
  const fakeLockResult: EnvelopeLockResult = {
    lockedAssetId: "locked_payment-test" as LockedAssetId,
    envelopeFormat: "TEST-ENVELOPE",
    envelopeVersion: "0.0.0-test",
    lockedPayload: utf8Bytes("locked"),
    lockedPayloadHash: "00".repeat(32),
    metadataHash: "11".repeat(32),
    qevEngineVersion: "test-fixture",
    developmentOnly: true
  };
  const lockedAsset = createLockedAssetRecord({
    assetVersionId: assetVersion.id,
    lockResult: fakeLockResult
  });
  const listing = createListing({
    asset,
    activeAssetVersionId: assetVersion.id,
    priceAmount: 2500,
    priceCurrency: "USD",
    licenseTerms: demoPersonalLicenseTerms
  });
  return { issuerKeys, creator, buyer, asset, assetVersion, lockedAsset, listing };
}

describe("MockPaymentAdapter.createCheckout", () => {
  it("binds the session to the listing, buyer, amount, and currency", async () => {
    const { listing, buyer } = await checkoutFixture();
    const payments = new MockPaymentAdapter();
    const session = await payments.createCheckout({ listing, buyer });
    expect(session.status).toBe("open");
    expect(session.listingId).toBe(listing.id);
    expect(session.buyerId).toBe(buyer.id);
    expect(session.amount).toBe(2500);
    expect(session.currency).toBe("USD");
    expect(session.provider).toBe("mock");
  });

  it("refuses checkout for an inactive listing", async () => {
    const { listing, buyer } = await checkoutFixture();
    const payments = new MockPaymentAdapter();
    await expect(
      payments.createCheckout({ listing: { ...listing, status: "paused" }, buyer })
    ).rejects.toThrow(/not active/);
  });

  it("rejects confirmation of an unknown session", async () => {
    const payments = new MockPaymentAdapter();
    await expect(
      payments.confirmPayment({ sessionId: "checkout_missing" as CheckoutSessionId })
    ).rejects.toThrow(/Unknown checkout session/);
  });
});

describe("payment-confirmed license issuance", () => {
  it("a mocked paid event yields a paid purchase and a license that verifies", async () => {
    const fixture = await checkoutFixture();
    const { purchase, session, confirmation } = await completeMockCheckout(
      new MockPaymentAdapter(),
      { listing: fixture.listing, buyer: fixture.buyer }
    );
    expect(purchase.status).toBe("paid");
    expect(purchase.paidAt).toBe(confirmation.occurredAt);
    expect(purchase.paymentProviderReference).toBe(session.providerReference);

    const license = await issueBuyerLicense({
      purchase,
      buyer: fixture.buyer,
      asset: fixture.asset,
      assetVersion: fixture.assetVersion,
      lockedAsset: fixture.lockedAsset,
      terms: fixture.listing.licenseTerms,
      issuer: "test-issuer",
      issuerPrivateKey: fixture.issuerKeys.privateKey
    });
    const verification = await verifyBuyerLicense({
      license,
      issuerPublicKey: fixture.issuerKeys.publicKey
    });
    expect(verification.status).toBe("pass");
  });

  it("a pending purchase (no confirmation) cannot obtain a license", async () => {
    const fixture = await checkoutFixture();
    const payments = new MockPaymentAdapter();
    const session = await payments.createCheckout({
      listing: fixture.listing,
      buyer: fixture.buyer
    });
    const pending = createPendingPurchase({
      listing: fixture.listing,
      buyer: fixture.buyer,
      session
    });
    expect(pending.status).toBe("pending");
    expect(pending.paidAt).toBeUndefined();
    await expect(
      issueBuyerLicense({
        purchase: pending,
        buyer: fixture.buyer,
        asset: fixture.asset,
        assetVersion: fixture.assetVersion,
        lockedAsset: fixture.lockedAsset,
        terms: fixture.listing.licenseTerms,
        issuer: "test-issuer",
        issuerPrivateKey: fixture.issuerKeys.privateKey
      })
    ).rejects.toThrow(/expected "paid"/);
  });

  it("a failed payment yields a failed purchase, no license, and no unlock path", async () => {
    const fixture = await checkoutFixture();
    const { purchase } = await completeMockCheckout(new MockPaymentAdapter(), {
      listing: fixture.listing,
      buyer: fixture.buyer,
      simulateOutcome: "failed"
    });
    expect(purchase.status).toBe("failed");
    expect(purchase.paidAt).toBeUndefined();
    await expect(
      issueBuyerLicense({
        purchase,
        buyer: fixture.buyer,
        asset: fixture.asset,
        assetVersion: fixture.assetVersion,
        lockedAsset: fixture.lockedAsset,
        terms: fixture.listing.licenseTerms,
        issuer: "test-issuer",
        issuerPrivateKey: fixture.issuerKeys.privateKey
      })
    ).rejects.toThrow(/expected "paid"/);
    // No license exists, so no unlock code can ever be bound to this purchase.
  });
});

describe("applyPaymentConfirmation", () => {
  it("rejects a confirmation from a different checkout session", async () => {
    const fixture = await checkoutFixture();
    const payments = new MockPaymentAdapter();
    const sessionA = await payments.createCheckout({
      listing: fixture.listing,
      buyer: fixture.buyer
    });
    const sessionB = await payments.createCheckout({
      listing: fixture.listing,
      buyer: fixture.buyer
    });
    const pendingA = createPendingPurchase({
      listing: fixture.listing,
      buyer: fixture.buyer,
      session: sessionA
    });
    const confirmationB = await payments.confirmPayment({ sessionId: sessionB.id });
    expect(() => applyPaymentConfirmation(pendingA, confirmationB)).toThrow(/does not match/);
  });

  it("rejects a confirmation whose amount was altered", async () => {
    const fixture = await checkoutFixture();
    const payments = new MockPaymentAdapter();
    const session = await payments.createCheckout({
      listing: fixture.listing,
      buyer: fixture.buyer
    });
    const pending = createPendingPurchase({
      listing: fixture.listing,
      buyer: fixture.buyer,
      session
    });
    const confirmation = await payments.confirmPayment({ sessionId: session.id });
    const tampered: PaymentConfirmation = {
      ...confirmation,
      session: { ...confirmation.session, amount: 1 }
    };
    expect(() => applyPaymentConfirmation(pending, tampered)).toThrow(/amount\/currency/);
  });

  it("is idempotent for repeated provider events", async () => {
    const fixture = await checkoutFixture();
    const payments = new MockPaymentAdapter();
    const { purchase, session } = await completeMockCheckout(payments, {
      listing: fixture.listing,
      buyer: fixture.buyer
    });
    const repeat = await payments.confirmPayment({ sessionId: session.id });
    expect(applyPaymentConfirmation(purchase, repeat)).toBe(purchase);
  });

  it("refuses to flip a completed session to a different outcome", async () => {
    const fixture = await checkoutFixture();
    const payments = new MockPaymentAdapter();
    const { session } = await completeMockCheckout(payments, {
      listing: fixture.listing,
      buyer: fixture.buyer
    });
    await expect(
      payments.confirmPayment({ sessionId: session.id, simulateOutcome: "failed" })
    ).rejects.toThrow(/already completed/);
  });
});
