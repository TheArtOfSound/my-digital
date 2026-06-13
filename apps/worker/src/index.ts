import { base64ToBytes, MockPaymentAdapter } from "@my-digital/core";
import {
  nobleCryptoProvider,
  QevVaultV2EnvelopeAdapter,
  type QevKdfPreset
} from "@my-digital/envelope";
import { createApp, Keystore, MarketplaceService } from "@my-digital/server-core";
import { D1MarketplaceStore } from "@my-digital/store";
import type { PaymentAdapter } from "@my-digital/types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MYDIGITAL_MASTER_KEY_B64: string;
  MYDIGITAL_KDF_PRESET?: string;
  MYDIGITAL_PAYMENTS?: string;
  MYDIGITAL_PUBLIC_URL?: string;
  MYDIGITAL_ADMIN_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** "on" routes checkout to each creator's connected Stripe account (direct payouts). */
  MYDIGITAL_CONNECT?: string;
  /** Platform application fee in basis points when Connect is on (default 0). */
  MYDIGITAL_CONNECT_FEE_BPS?: string;
}

// The service is built once per isolate and reused across requests.
let servicePromise: Promise<MarketplaceService> | null = null;
let appPromise: Promise<ReturnType<typeof createApp>> | null = null;

function resolvePreset(value: string | undefined): QevKdfPreset {
  return value === "edge" || value === "quick" || value === "strong" || value === "vault"
    ? value
    : "edge";
}

async function buildPayments(env: Env): Promise<{ adapter: PaymentAdapter; mode: string }> {
  if (env.MYDIGITAL_PAYMENTS === "stripe") {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("MYDIGITAL_PAYMENTS=stripe requires the STRIPE_SECRET_KEY secret.");
    }
    const publicUrl = env.MYDIGITAL_PUBLIC_URL ?? "https://mydigital.imagineqira.com";
    const { createStripePaymentAdapter } = await import("@my-digital/payments-stripe");
    const adapter = await createStripePaymentAdapter({
      secretKey: env.STRIPE_SECRET_KEY,
      successUrl: `${publicUrl}/checkout/done?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${publicUrl}/`,
      ...(env.STRIPE_WEBHOOK_SECRET ? { webhookSecret: env.STRIPE_WEBHOOK_SECRET } : {})
    });
    return { adapter, mode: "stripe" };
  }
  return { adapter: new MockPaymentAdapter(), mode: "mock" };
}

async function getApp(env: Env): Promise<ReturnType<typeof createApp>> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    if (!env.MYDIGITAL_MASTER_KEY_B64) {
      throw new Error("The MYDIGITAL_MASTER_KEY_B64 secret is not set.");
    }
    // Fail closed: in production (live payments) the management endpoints must be
    // gated. Refuse to boot rather than silently serving them open if the token
    // is ever unset. (Use a long, random token; >= 32 chars recommended.)
    if (env.MYDIGITAL_PAYMENTS === "stripe" && !env.MYDIGITAL_ADMIN_TOKEN) {
      throw new Error(
        "Live (stripe) mode requires MYDIGITAL_ADMIN_TOKEN to gate creator/management endpoints."
      );
    }
    const store = new D1MarketplaceStore(env.DB);
    const keystore = await Keystore.fromKeyBytes(
      base64ToBytes(env.MYDIGITAL_MASTER_KEY_B64),
      nobleCryptoProvider
    );
    const payments = await buildPayments(env);
    servicePromise = MarketplaceService.create({
      store,
      keystore,
      envelope: new QevVaultV2EnvelopeAdapter({
        preset: resolvePreset(env.MYDIGITAL_KDF_PRESET),
        crypto: nobleCryptoProvider
      }),
      payments: payments.adapter,
      issuerName: "my-digital-issuer",
      verificationUrlBase: "https://mydigital.imagineqira.com/verify",
      connect: {
        enabled: env.MYDIGITAL_CONNECT === "on",
        applicationFeeBps: Number(env.MYDIGITAL_CONNECT_FEE_BPS) || 0,
        publicBaseUrl: env.MYDIGITAL_PUBLIC_URL ?? "https://mydigital.imagineqira.com"
      }
    });
    const service = await servicePromise;
    return createApp(service, {
      paymentsProvider: payments.mode,
      ...(env.MYDIGITAL_ADMIN_TOKEN ? { adminToken: env.MYDIGITAL_ADMIN_TOKEN } : {})
      // No staticRoot: static assets are served by the ASSETS binding below.
    });
  })();
  return appPromise;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const app = await getApp(env);
      return app.fetch(request, env, ctx);
    }
    // Everything else is the SPA: static assets, with index.html SPA fallback
    // (configured via not_found_handling = "single-page-application").
    return env.ASSETS.fetch(request);
  }
};
