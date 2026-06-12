import type { Buyer, BuyerId, CreatorId, AssetId, AssetVersionId, Listing, ListingId } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import {
  StripePaymentAdapter,
  type StripeLikeCheckoutSession,
  type StripeLikeClient,
  type StripeLikeEvent
} from "./index";

const listing: Listing = {
  id: "listing_stripe-test" as ListingId,
  assetId: "asset_stripe-test" as AssetId,
  activeAssetVersionId: "assetver_stripe-test" as AssetVersionId,
  creatorId: "creator_stripe-test" as CreatorId,
  title: "Stripe Test Pack",
  description: "Test",
  priceAmount: 1900,
  priceCurrency: "USD",
  licenseTerms: {
    personalUse: true,
    commercialUse: false,
    clientWorkAllowed: false,
    redistributionAllowed: false,
    resaleAllowed: false,
    aiTrainingAllowed: false,
    attributionRequired: true,
    seatCount: 1
  },
  status: "active",
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z"
};

const buyer: Buyer = {
  id: "buyer_stripe-test" as BuyerId,
  emailHash: "ab".repeat(32),
  createdAt: "2026-06-11T00:00:00.000Z"
};

interface FakeState {
  created: Record<string, unknown>[];
  session: StripeLikeCheckoutSession;
  webhookSecretSeen?: string;
}

function fakeClient(state: FakeState): StripeLikeClient {
  return {
    checkout: {
      sessions: {
        async create(params) {
          state.created.push(params);
          return state.session;
        },
        async retrieve(id) {
          if (id !== state.session.id) throw new Error("no such session");
          return state.session;
        }
      }
    },
    webhooks: {
      async constructEventAsync(payload, header, secret) {
        state.webhookSecretSeen = secret;
        if (header !== "valid-signature") throw new Error("Webhook signature verification failed");
        return JSON.parse(payload) as StripeLikeEvent;
      }
    }
  };
}

function makeAdapter(state: FakeState): StripePaymentAdapter {
  return new StripePaymentAdapter({
    client: fakeClient(state),
    successUrl: "https://mydigital.imagineqira.com/checkout/done?session={CHECKOUT_SESSION_ID}",
    cancelUrl: "https://mydigital.imagineqira.com/checkout/cancelled",
    webhookSecret: "whsec_test"
  });
}

function baseStripeSession(): StripeLikeCheckoutSession {
  return {
    id: "cs_test_123",
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
    status: "open",
    payment_status: "unpaid",
    amount_total: 1900,
    currency: "usd",
    metadata: {}
  };
}

describe("StripePaymentAdapter.createCheckout", () => {
  it("creates a hosted checkout session bound to the listing and buyer", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({ listing, buyer });

    expect(session.provider).toBe("stripe");
    expect(session.providerReference).toBe("cs_test_123");
    expect(session.checkoutUrl).toContain("checkout.stripe.com");
    expect(session.amount).toBe(1900);

    const params = state.created[0] as {
      mode: string;
      line_items: Array<{ price_data: { unit_amount: number; currency: string } }>;
      metadata: Record<string, string>;
    };
    expect(params.mode).toBe("payment");
    expect(params.line_items[0]?.price_data.unit_amount).toBe(1900);
    expect(params.line_items[0]?.price_data.currency).toBe("usd");
    expect(params.metadata.checkoutSessionId).toBe(session.id);
  });

  it("refuses inactive listings and the mock-only simulateOutcome control", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    await expect(
      adapter.createCheckout({ listing: { ...listing, status: "paused" }, buyer })
    ).rejects.toThrow(/not active/);
    const session = await adapter.createCheckout({ listing, buyer });
    await expect(
      adapter.confirmPayment({ sessionId: session.id, simulateOutcome: "paid" })
    ).rejects.toThrow(/mock-only/);
  });
});

describe("StripePaymentAdapter.confirmPayment (poll)", () => {
  it("throws while the session is incomplete, confirms once paid, and is idempotent", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({ listing, buyer });

    await expect(adapter.confirmPayment({ sessionId: session.id })).rejects.toThrow(
      /has not completed yet/
    );

    state.session = { ...state.session, status: "complete", payment_status: "paid" };
    const confirmation = await adapter.confirmPayment({ sessionId: session.id });
    expect(confirmation.outcome).toBe("paid");
    expect(confirmation.session.status).toBe("paid");

    const repeat = await adapter.confirmPayment({ sessionId: session.id });
    expect(repeat).toBe(confirmation);
  });

  it("maps expired sessions to failed confirmations", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({ listing, buyer });
    state.session = { ...state.session, status: "expired", payment_status: "unpaid" };
    const confirmation = await adapter.confirmPayment({ sessionId: session.id });
    expect(confirmation.outcome).toBe("failed");
  });

  it("refuses confirmation when Stripe reports a different amount", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({ listing, buyer });
    state.session = {
      ...state.session,
      status: "complete",
      payment_status: "paid",
      amount_total: 100
    };
    await expect(adapter.confirmPayment({ sessionId: session.id })).rejects.toThrow(
      /does not match session/
    );
  });
});

describe("StripePaymentAdapter.confirmFromWebhook", () => {
  it("verifies the signature, maps completed events, and stays idempotent", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({ listing, buyer });

    const event: StripeLikeEvent = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          ...state.session,
          status: "complete",
          payment_status: "paid",
          metadata: { checkoutSessionId: session.id }
        }
      }
    };
    const confirmation = await adapter.confirmFromWebhook(JSON.stringify(event), "valid-signature");
    expect(confirmation?.outcome).toBe("paid");
    expect(confirmation?.providerEventId).toBe("evt_1");
    expect(state.webhookSecretSeen).toBe("whsec_test");

    const repeat = await adapter.confirmFromWebhook(JSON.stringify(event), "valid-signature");
    expect(repeat).toBe(confirmation);
  });

  it("rejects bad signatures and ignores unrelated events", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    await adapter.createCheckout({ listing, buyer });
    await expect(adapter.confirmFromWebhook("{}", "bad-signature")).rejects.toThrow(
      /signature verification failed/
    );
    const unrelated: StripeLikeEvent = {
      id: "evt_2",
      type: "invoice.created",
      data: { object: baseStripeSession() }
    };
    expect(
      await adapter.confirmFromWebhook(JSON.stringify(unrelated), "valid-signature")
    ).toBeNull();
  });

  it("maps expiry events to failed confirmations", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({ listing, buyer });
    const event: StripeLikeEvent = {
      id: "evt_3",
      type: "checkout.session.expired",
      data: { object: { ...state.session, metadata: { checkoutSessionId: session.id } } }
    };
    const confirmation = await adapter.confirmFromWebhook(JSON.stringify(event), "valid-signature");
    expect(confirmation?.outcome).toBe("failed");
  });
});
