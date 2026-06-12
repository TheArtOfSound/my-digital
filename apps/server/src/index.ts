import { serve } from "@hono/node-server";
import { MockPaymentAdapter } from "@my-digital/core";
import { QevVaultV2EnvelopeAdapter, type QevKdfPreset } from "@my-digital/envelope";
import { openSqliteStore } from "@my-digital/store";
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

const store = openSqliteStore({ path: dbPath });
const keystore = await Keystore.open({ keyFilePath });
const service = await MarketplaceService.create({
  store,
  keystore,
  envelope: new QevVaultV2EnvelopeAdapter({ preset }),
  payments: new MockPaymentAdapter(),
  issuerName: "my-digital-issuer",
  verificationUrlBase: "https://mydigital.imagineqira.com/verify"
});

serve({ fetch: createApp(service).fetch, port });

console.log("=".repeat(74));
console.log(`My Digital API server listening on http://localhost:${port}`);
console.log(`Database:      ${dbPath}`);
console.log(`Master key:    ${process.env.MYDIGITAL_MASTER_KEY_B64 ? "from env" : keyFilePath} (dev stand-in for a KMS)`);
console.log(`Envelope:      QEV Vault V2 (BRY-NFET-SX-VAULT-V2), Argon2id preset "${preset}"`);
console.log(`Issuer:        ${service.issuerInfo().name}`);
console.log("Payments:      mock adapter — no real charges.");
console.log("Custody:       passphrases sealed under the master key before storage.");
console.log("Unlock:        happens client-side; buyer credentials are never sent here.");
console.log("=".repeat(74));
