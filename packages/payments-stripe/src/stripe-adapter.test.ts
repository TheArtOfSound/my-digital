import type { Buyer, BuyerId, CreatorId, AssetId, AssetVersionId, Listing, ListingId } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import {
  StripePaymentAdapter,
  type StripeLikeAccount,
  type StripeLikeCheckoutSession,
  type StripeLikeClient,
  type StripeLikeEvent,
  type StripeRequestOptions
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
  lastCreateOptions?: StripeRequestOptions | undefined;
  lastRetrieveOptions?: StripeRequestOptions | undefined;
  accountsCreated?: Record<string, unknown>[];
  onboardingParams?: Record<string, unknown>;
  accountStatus?: StripeLikeAccount;
}

function fakeClient(state: FakeState): StripeLikeClient {
  return {
    checkout: {
      sessions: {
        async create(params, options) {
          state.created.push(params);
          state.lastCreateOptions = options;
          return state.session;
        },
        async retrieve(id, options) {
          if (id !== state.session.id) throw new Error("no such session");
          state.lastRetrieveOptions = options;
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
    },
    accounts: {
      async create(params) {
        (state.accountsCreated ??= []).push(params);
        return { id: "acct_test_123" };
      },
      async retrieve(id) {
        return { ...(state.accountStatus ?? {}), id };
      }
    },
    accountLinks: {
      async create(params) {
        state.onboardingParams = params;
        return { url: "https://connect.stripe.com/setup/s/acct_test_123" };
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

describe("StripePaymentAdapter Connect (direct payouts)", () => {
  it("routes the charge to the creator's connected account with an application fee", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({
      listing,
      buyer,
      connectedAccountId: "acct_creator_1",
      applicationFeeAmount: 95
    });
    expect(session.connectedAccountId).toBe("acct_creator_1");
    expect(state.lastCreateOptions?.stripeAccount).toBe("acct_creator_1");
    const params = state.created[0] as {
      payment_intent_data?: { application_fee_amount?: number };
    };
    expect(params.payment_intent_data?.application_fee_amount).toBe(95);
  });

  it("omits the application fee when zero and confirms on the connected account", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const session = await adapter.createCheckout({
      listing,
      buyer,
      connectedAccountId: "acct_creator_1",
      applicationFeeAmount: 0
    });
    const params = state.created[0] as { payment_intent_data?: unknown };
    expect(params.payment_intent_data).toBeUndefined();

    state.session = { ...state.session, status: "complete", payment_status: "paid" };
    const confirmation = await adapter.confirmPayment({ sessionId: session.id });
    expect(confirmation.outcome).toBe("paid");
    expect(state.lastRetrieveOptions?.stripeAccount).toBe("acct_creator_1");
  });

  it("creates an Express account and a hosted onboarding link", async () => {
    const state: FakeState = { created: [], session: baseStripeSession() };
    const adapter = makeAdapter(state);
    const accountId = await adapter.createConnectedAccount({ email: "creator@example.com" });
    expect(accountId).toBe("acct_test_123");
    expect((state.accountsCreated?.[0] as { type?: string }).type).toBe("express");

    const url = await adapter.createOnboardingLink({
      accountId,
      returnUrl: "https://mydigital.imagineqira.com/creator?payouts=return",
      refreshUrl: "https://mydigital.imagineqira.com/creator?payouts=refresh"
    });
    expect(url).toContain("connect.stripe.com");
    expect(state.onboardingParams?.account).toBe("acct_test_123");
    expect(state.onboardingParams?.type).toBe("account_onboarding");
  });

  it("reports account status from Stripe flags", async () => {
    const state: FakeState = {
      created: [],
      session: baseStripeSession(),
      accountStatus: {
        id: "acct_test_123",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true
      }
    };
    const adapter = makeAdapter(state);
    const status = await adapter.getAccountStatus("acct_test_123");
    expect(status).toEqual({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true
    });
  });

  it("rejects Connect calls when the client lacks Connect support", async () => {
    const noConnect = new StripePaymentAdapter({
      client: {
        checkout: {
          sessions: {
            async create() {
              return baseStripeSession();
            },
            async retrieve() {
              return baseStripeSession();
            }
          }
        },
        webhooks: {
          async constructEventAsync() {
            return { id: "evt", type: "x", data: { object: baseStripeSession() } };
          }
        }
      },
      successUrl: "https://x/done",
      cancelUrl: "https://x/cancel"
    });
    await expect(noConnect.createConnectedAccount({})).rejects.toThrow(/Connect/);
    await expect(noConnect.getAccountStatus("acct_x")).rejects.toThrow(/Connect/);
  });
});
