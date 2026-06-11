import type {
  Buyer,
  CheckoutSession,
  CheckoutSessionId,
  ConfirmPaymentInput,
  CreateCheckoutInput,
  Listing,
  PaymentAdapter,
  PaymentConfirmation,
  Purchase
} from "@my-digital/types";
import { newCheckoutSessionId, newPurchaseId } from "./ids";

/**
 * Payment boundary: a license may exist only downstream of a confirmed paid
 * event from a PaymentAdapter. The mock adapter simulates a provider and
 * moves no money; a future Stripe adapter lives in its own package behind
 * the same contract, with webhook-confirmed events. Checkout sessions are
 * adapter-side state and are not yet persisted marketplace records.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  private sessions = new Map<CheckoutSessionId, CheckoutSession>();
  private confirmations = new Map<CheckoutSessionId, PaymentConfirmation>();

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    if (input.listing.status !== "active") {
      throw new Error(`Cannot create checkout: listing ${input.listing.id} is not active.`);
    }
    const session: CheckoutSession = {
      id: newCheckoutSessionId(),
      listingId: input.listing.id,
      buyerId: input.buyer.id,
      amount: input.listing.priceAmount,
      currency: input.listing.priceCurrency,
      status: "open",
      provider: "mock",
      providerReference: `mockpay_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async confirmPayment(input: ConfirmPaymentInput): Promise<PaymentConfirmation> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Unknown checkout session ${input.sessionId}.`);
    }
    const requestedOutcome = input.simulateOutcome ?? "paid";
    const existing = this.confirmations.get(input.sessionId);
    if (existing) {
      if (existing.outcome !== requestedOutcome) {
        throw new Error(
          `Checkout session ${input.sessionId} already completed with outcome "${existing.outcome}".`
        );
      }
      // Provider events are at-least-once; repeated confirmation is a no-op.
      return existing;
    }
    const completedAt = new Date().toISOString();
    const completed: CheckoutSession = {
      ...session,
      status: requestedOutcome === "paid" ? "paid" : "failed",
      completedAt
    };
    this.sessions.set(session.id, completed);
    const confirmation: PaymentConfirmation = {
      session: completed,
      outcome: requestedOutcome,
      providerEventId: `mockevt_${crypto.randomUUID()}`,
      occurredAt: completedAt
    };
    this.confirmations.set(session.id, confirmation);
    return confirmation;
  }
}

export function createPendingPurchase(input: {
  listing: Listing;
  buyer: Buyer;
  session: CheckoutSession;
  createdAt?: string;
}): Purchase {
  if (input.session.listingId !== input.listing.id || input.session.buyerId !== input.buyer.id) {
    throw new Error(
      `Checkout session ${input.session.id} does not belong to this listing/buyer pair.`
    );
  }
  return {
    id: newPurchaseId(),
    listingId: input.listing.id,
    buyerId: input.buyer.id,
    assetVersionId: input.listing.activeAssetVersionId,
    paymentProvider: input.session.provider,
    paymentProviderReference: input.session.providerReference,
    amountPaid: input.session.amount,
    currency: input.session.currency,
    status: "pending",
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}

export function applyPaymentConfirmation(
  purchase: Purchase,
  confirmation: PaymentConfirmation
): Purchase {
  if (confirmation.session.providerReference !== purchase.paymentProviderReference) {
    throw new Error(
      `Confirmation for session ${confirmation.session.id} does not match purchase ${purchase.id}.`
    );
  }
  if (
    confirmation.session.amount !== purchase.amountPaid ||
    confirmation.session.currency !== purchase.currency
  ) {
    throw new Error(
      `Confirmation amount/currency does not match purchase ${purchase.id}; refusing to apply it.`
    );
  }
  if (purchase.status !== "pending") {
    const alreadyMatches =
      (purchase.status === "paid" && confirmation.outcome === "paid") ||
      (purchase.status === "failed" && confirmation.outcome === "failed");
    if (alreadyMatches) return purchase;
    throw new Error(`Purchase ${purchase.id} is already ${purchase.status}.`);
  }
  return confirmation.outcome === "paid"
    ? { ...purchase, status: "paid", paidAt: confirmation.occurredAt }
    : { ...purchase, status: "failed" };
}

export interface CompletedMockCheckout {
  session: CheckoutSession;
  confirmation: PaymentConfirmation;
  purchase: Purchase;
}

/** Runs createCheckout -> pending purchase -> confirm -> apply, in one call. */
export async function completeMockCheckout(
  payments: PaymentAdapter,
  input: { listing: Listing; buyer: Buyer; simulateOutcome?: "paid" | "failed" }
): Promise<CompletedMockCheckout> {
  const session = await payments.createCheckout({ listing: input.listing, buyer: input.buyer });
  const pending = createPendingPurchase({
    listing: input.listing,
    buyer: input.buyer,
    session
  });
  const confirmation = await payments.confirmPayment({
    sessionId: session.id,
    ...(input.simulateOutcome !== undefined ? { simulateOutcome: input.simulateOutcome } : {})
  });
  return { session, confirmation, purchase: applyPaymentConfirmation(pending, confirmation) };
}
