import { serve } from "@hono/node-server";
import { MockPaymentAdapter } from "@my-digital/core";
import { QevVaultV2EnvelopeAdapter, type QevKdfPreset } from "@my-digital/envelope";
import { openSqliteStore } from "@my-digital/store";
import type { PaymentAdapter } from "@my-digital/types";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { Keystore } from "./keystore";
import { MarketplaceService } from "./service";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "..", "data");
const dbPath = process.env.MYDIGITAL_DB ?? path.join(dataDir, "my-digital.sqlite");
const keyFilePath = path.join(dataDir, "master-key.b64");
const port = Number(process.env.PORT ?? 8787);
const presetEnv = process.env.MYDIGITAL_KDF_PRESET;
const preset: QevKdfPreset =
  presetEnv === "quick" || presetEnv === "strong" || presetEnv === "vault" ? presetEnv : "strong";
const publicUrl = process.env.MYDIGITAL_PUBLIC_URL ?? "http://localhost:5173";
const paymentsMode = process.env.MYDIGITAL_PAYMENTS === "stripe" ? "stripe" : "mock";

let payments: PaymentAdapter;
if (paymentsMode === "stripe") {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("MYDIGITAL_PAYMENTS=stripe requires STRIPE_SECRET_KEY.");
  }
  const { createStripePaymentAdapter } = await import("@my-digital/payments-stripe");
  payments = await createStripePaymentAdapter({
    secretKey,
    successUrl: `${publicUrl}/checkout/done?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${publicUrl}/`,
    ...(process.env.STRIPE_WEBHOOK_SECRET
      ? { webhookSecret: process.env.STRIPE_WEBHOOK_SECRET }
      : {})
  });
} else {
  payments = new MockPaymentAdapter();
}

const store = openSqliteStore({ path: dbPath });
const keystore = await Keystore.open({ keyFilePath });
const service = await MarketplaceService.create({
  store,
  keystore,
  envelope: new QevVaultV2EnvelopeAdapter({ preset }),
  payments,
  issuerName: "my-digital-issuer",
  verificationUrlBase: "https://mydigital.imagineqira.com/verify"
});

const webDist = path.resolve(here, "..", "..", "web", "dist");
const staticRoot = existsSync(path.join(webDist, "index.html")) ? webDist : undefined;
const adminToken = process.env.MYDIGITAL_ADMIN_TOKEN;

const app = createApp(service, {
  paymentsProvider: paymentsMode,
  ...(adminToken ? { adminToken } : {}),
  ...(staticRoot ? { staticRoot } : {})
});
serve({ fetch: app.fetch, port });

console.log("=".repeat(74));
console.log(`My Digital API server listening on http://localhost:${port}`);
console.log(`Database:      ${dbPath}`);
console.log(
  `Master key:    ${process.env.MYDIGITAL_MASTER_KEY_B64 ? "from env" : keyFilePath} (dev stand-in for a KMS)`
);
console.log(`Envelope:      QEV Vault V2 (BRY-NFET-SX-VAULT-V2), Argon2id preset "${preset}"`);
console.log(`Issuer:        ${service.issuerInfo().name}`);
if (paymentsMode === "stripe") {
  console.log("Payments:      STRIPE adapter — not yet validated against live Stripe;");
  console.log("               see docs/DEPLOYMENT.md before charging real cards.");
} else {
  console.log("Payments:      mock adapter — no real charges.");
}
console.log(
  `Static web:    ${staticRoot ? `serving ${staticRoot} (single-process mode)` : "not built (API only; use pnpm dev for the web app)"}`
);
console.log(
  `Admin reset:   ${adminToken ? "token-gated (MYDIGITAL_ADMIN_TOKEN)" : "open (dev; set MYDIGITAL_ADMIN_TOKEN to gate)"}`
);
console.log("Custody:       passphrases sealed under the master key before storage.");
console.log("Unlock:        happens client-side; buyer credentials are never sent here.");
console.log("=".repeat(74));
