import { newCheckoutSessionId } from "@my-digital/core";
import type {
  CheckoutSession,
  CheckoutSessionId,
  ConfirmPaymentInput,
  CreateCheckoutInput,
  PaymentAdapter,
  PaymentConfirmation
} from "@my-digital/types";

/**
 * Stripe adapter behind the PaymentAdapter contract.
 *
 * Status: the adapter logic is fully unit-tested against an injected fake
 * client, but it has NOT yet been exercised against live Stripe. Before
 * production use it needs a test purchase with real keys, plus the
 * redirect/webhook fulfillment flow described in docs/DEPLOYMENT.md.
 *
 * Confirmation paths:
 * - confirmPayment(sessionId): polls the Checkout Session (used when the
 *   buyer returns from the hosted page via success_url).
 * - confirmFromWebhook(rawBody, signature): verifies and maps a webhook
 *   event (checkout.session.completed / expired). Production fulfillment
 *   should prefer webhooks; events are at-least-once, so confirmations are
 *   idempotent here just like the mock adapter.
 *
 * The mock-only `simulateOutcome` control is rejected explicitly.
 */

/** Structural subset of the Stripe SDK this adapter uses; tests inject fakes. */
export interface StripeLikeCheckoutSession {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}

export interface StripeLikeEvent {
  id: string;
  type: string;
  data: { object: StripeLikeCheckoutSession };
}

export interface StripeLikeClient {
  checkout: {
    sessions: {
      create(params: Record<string, unknown>): Promise<StripeLikeCheckoutSession>;
      retrieve(id: string): Promise<StripeLikeCheckoutSession>;
    };
  };
  webhooks: {
    constructEventAsync(
      payload: string,
      header: string,
      secret: string
    ): Promise<StripeLikeEvent>;
  };
}

export interface StripePaymentAdapterOptions {
  client: StripeLikeClient;
  /** Where Stripe redirects after payment; `{CHECKOUT_SESSION_ID}` is supported by Stripe. */
  successUrl: string;
  cancelUrl: string;
  /** Required for confirmFromWebhook. */
  webhookSecret?: string;
}

export class StripePaymentAdapter implements PaymentAdapter {
  private sessions = new Map<CheckoutSessionId, CheckoutSession>();
  private byProviderReference = new Map<string, CheckoutSessionId>();
  private confirmations = new Map<CheckoutSessionId, PaymentConfirmation>();

  constructor(private readonly options: StripePaymentAdapterOptions) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    if (input.listing.status !== "active") {
      throw new Error(`Cannot create checkout: listing ${input.listing.id} is not active.`);
    }
    const sessionId = newCheckoutSessionId();
    const stripeSession = await this.options.client.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.listing.priceCurrency.toLowerCase(),
            unit_amount: input.listing.priceAmount,
            product_data: { name: input.listing.title }
          }
        }
      ],
      success_url: this.options.successUrl,
      cancel_url: this.options.cancelUrl,
      metadata: {
        checkoutSessionId: sessionId as string,
        listingId: input.listing.id as string,
        buyerId: input.buyer.id as string
      }
    });
    const session: CheckoutSession = {
      id: sessionId,
      listingId: input.listing.id,
      buyerId: input.buyer.id,
      amount: input.listing.priceAmount,
      currency: input.listing.priceCurrency,
      status: "open",
      provider: "stripe",
      providerReference: stripeSession.id,
      createdAt: new Date().toISOString(),
      ...(stripeSession.url ? { checkoutUrl: stripeSession.url } : {})
    };
    this.sessions.set(session.id, session);
    this.byProviderReference.set(stripeSession.id, session.id);
    return session;
  }

  restoreSession(session: CheckoutSession): void {
    if (!this.sessions.has(session.id)) {
      this.sessions.set(session.id, session);
      this.byProviderReference.set(session.providerReference, session.id);
    }
  }

  async confirmPayment(input: ConfirmPaymentInput): Promise<PaymentConfirmation> {
    if (input.simulateOutcome !== undefined) {
      throw new Error("simulateOutcome is a mock-only control; the Stripe adapter rejects it.");
    }
    const session = this.sessions.get(input.sessionId);
    if (!session) throw new Error(`Unknown checkout session ${input.sessionId}.`);
    const existing = this.confirmations.get(input.sessionId);
    if (existing) return existing;

    const stripeSession = await this.options.client.checkout.sessions.retrieve(
      session.providerReference
    );
    if (stripeSession.payment_status === "paid") {
      return this.recordConfirmation(session, stripeSession, "paid", `poll_${stripeSession.id}`);
    }
    if (stripeSession.status === "expired") {
      return this.recordConfirmation(session, stripeSession, "failed", `poll_${stripeSession.id}`);
    }
    throw new Error(
      "The Stripe checkout session has not completed yet. Retry after the buyer finishes the hosted checkout."
    );
  }

  /** Verifies a Stripe webhook and maps it to a PaymentConfirmation (or null for ignorable events). */
  async confirmFromWebhook(rawBody: string, signature: string): Promise<PaymentConfirmation | null> {
    if (!this.options.webhookSecret) {
      throw new Error("webhookSecret is required to verify Stripe webhooks.");
    }
    const event = await this.options.client.webhooks.constructEventAsync(
      rawBody,
      signature,
      this.options.webhookSecret
    );
    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded" &&
      event.type !== "checkout.session.expired" &&
      event.type !== "checkout.session.async_payment_failed"
    ) {
      return null;
    }
    const stripeSession = event.data.object;
    const sessionId =
      (stripeSession.metadata?.checkoutSessionId as CheckoutSessionId | undefined) ??
      this.byProviderReference.get(stripeSession.id);
    if (!sessionId) {
      throw new Error("Webhook session carries no checkoutSessionId metadata.");
    }
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown checkout session ${sessionId} in webhook.`);
    const existing = this.confirmations.get(sessionId);
    if (existing) return existing;
    const outcome =
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
        ? ("paid" as const)
        : ("failed" as const);
    return this.recordConfirmation(session, stripeSession, outcome, event.id);
  }

  private recordConfirmation(
    session: CheckoutSession,
    stripeSession: StripeLikeCheckoutSession,
    outcome: "paid" | "failed",
    providerEventId: string
  ): PaymentConfirmation {
    if (outcome === "paid") {
      const amountMatches =
        (stripeSession.amount_total ?? session.amount) === session.amount &&
        (stripeSession.currency ?? session.currency.toLowerCase()) ===
          session.currency.toLowerCase();
      if (!amountMatches) {
        throw new Error(
          `Stripe reported amount/currency that does not match session ${session.id}; refusing to confirm.`
        );
      }
    }
    const completedAt = new Date().toISOString();
    const completed: CheckoutSession = {
      ...session,
      status: outcome === "paid" ? "paid" : "failed",
      completedAt
    };
    this.sessions.set(session.id, completed);
    const confirmation: PaymentConfirmation = {
      session: completed,
      outcome,
      providerEventId,
      occurredAt: completedAt
    };
    this.confirmations.set(session.id, confirmation);
    return confirmation;
  }
}

/**
 * Builds the adapter with the real Stripe SDK (lazy import; server-side only).
 * Uses the fetch HTTP client and the SubtleCrypto webhook provider so the
 * same construction works on Node 18+ and Cloudflare Workers.
 */
export async function createStripePaymentAdapter(options: {
  secretKey: string;
  successUrl: string;
  cancelUrl: string;
  webhookSecret?: string;
}): Promise<StripePaymentAdapter> {
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(options.secretKey, {
    httpClient: Stripe.createFetchHttpClient()
  });
  const cryptoProvider = Stripe.createSubtleCryptoProvider();
  const client: StripeLikeClient = {
    checkout: {
      sessions: {
        create: async (params) =>
          (await stripe.checkout.sessions.create(
            params as never
          )) as unknown as StripeLikeCheckoutSession,
        retrieve: async (id) =>
          (await stripe.checkout.sessions.retrieve(id)) as unknown as StripeLikeCheckoutSession
      }
    },
    webhooks: {
      constructEventAsync: async (payload, header, secret) =>
        (await stripe.webhooks.constructEventAsync(
          payload,
          header,
          secret,
          undefined,
          cryptoProvider
        )) as unknown as StripeLikeEvent
    }
  };
  return new StripePaymentAdapter({
    client,
    successUrl: options.successUrl,
    cancelUrl: options.cancelUrl,
    ...(options.webhookSecret !== undefined ? { webhookSecret: options.webhookSecret } : {})
  });
}
