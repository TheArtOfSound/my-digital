import { base64ToBytes } from "@my-digital/core";
import { QEV_VAULT_SCHEMA } from "@my-digital/envelope";
import type {
  LicenseId,
  LicenseTerms,
  ListingId,
  LockedAssetId,
  ProofReceiptId,
  PurchaseId
} from "@my-digital/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import type { MarketplaceService } from "./service";

export interface CreateAppOptions {
  /** When set, POST /api/admin/reset requires `Authorization: Bearer <token>`. */
  adminToken?: string;
  /** When set, non-/api GETs serve this static directory with SPA fallback. */
  staticRoot?: string;
  /** Reported by /api/health; defaults to "mock". */
  paymentsProvider?: string;
}

const STATIC_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

interface CreateListingBody {
  title: string;
  description: string;
  category: string;
  priceAmount: number;
  priceCurrency: string;
  licenseTerms: LicenseTerms;
  fileName: string;
  mimeType: string;
  payloadB64: string;
}

interface CheckoutBody {
  listingId: string;
  email: string;
  displayName?: string;
  simulateOutcome?: "paid" | "failed";
}

export function createApp(service: MarketplaceService, options: CreateAppOptions = {}): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  });

  app.get("/api/health", (c) =>
    c.json({ ok: true, envelope: QEV_VAULT_SCHEMA, payments: options.paymentsProvider ?? "mock" })
  );

  app.get("/api/state", async (c) => c.json(await service.getState()));

  app.get("/api/issuer", (c) => c.json(service.issuerInfo()));

  app.post("/api/creator", async (c) => {
    const body = await c.req.json<{ displayName: string; handle: string; email: string }>();
    return c.json(await service.ensureCreator(body), 201);
  });

  app.post("/api/listings", async (c) => {
    const body = await c.req.json<CreateListingBody>();
    if (typeof body.payloadB64 !== "string" || body.payloadB64.length > 3_000_000) {
      return c.json({ error: "Payload is missing or exceeds the 2 MB dev limit." }, 413);
    }
    const result = await service.createLockedListing({
      title: body.title,
      description: body.description,
      category: body.category,
      priceAmount: body.priceAmount,
      priceCurrency: body.priceCurrency,
      licenseTerms: body.licenseTerms,
      fileName: body.fileName,
      mimeType: body.mimeType,
      payload: base64ToBytes(body.payloadB64)
    });
    return c.json(result, 201);
  });

  app.post("/api/checkout", async (c) => {
    const body = await c.req.json<CheckoutBody>();
    const outcome = await service.checkout({
      listingId: body.listingId as ListingId,
      email: body.email,
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
      ...(body.simulateOutcome === "failed" ? { simulateOutcome: "failed" as const } : {})
    });
    return c.json(outcome, 201);
  });

  app.post("/api/checkout/begin", async (c) => {
    const body = await c.req.json<{ listingId: string; email: string; displayName?: string }>();
    const begun = await service.beginCheckout({
      listingId: body.listingId as ListingId,
      email: body.email,
      ...(body.displayName !== undefined ? { displayName: body.displayName } : {})
    });
    return c.json(begun, 201);
  });

  app.post("/api/checkout/complete", async (c) => {
    const body = await c.req.json<{ purchaseId?: string; providerReference?: string }>();
    const outcome = await service.completeCheckout({
      ...(body.purchaseId !== undefined ? { purchaseId: body.purchaseId as PurchaseId } : {}),
      ...(body.providerReference !== undefined
        ? { providerReference: body.providerReference }
        : {})
    });
    return c.json(outcome, 201);
  });

  app.post("/api/webhooks/stripe", async (c) => {
    const signature = c.req.header("stripe-signature");
    if (!signature) return c.json({ error: "Missing stripe-signature header." }, 400);
    const rawBody = await c.req.text();
    return c.json(await service.handlePaymentWebhook(rawBody, signature));
  });

  app.get("/api/licenses/:id/vault", async (c) => {
    const vault = await service.getBuyerVault(c.req.param("id") as LicenseId);
    if (!vault) return c.json({ error: "No vault exists for this license." }, 404);
    return new Response(new Uint8Array(vault.payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${vault.fileName}"`,
        "X-Vault-Hash": vault.payloadHash
      }
    });
  });

  app.get("/api/locked-assets/:id/payload", async (c) => {
    const payload = await service.getBaseLockedPayload(c.req.param("id") as LockedAssetId);
    if (!payload) return c.json({ error: "No locked payload for this asset." }, 404);
    return new Response(new Uint8Array(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  app.post("/api/licenses/:id/revoke", async (c) => {
    const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));
    const revocation = await service.revokeLicense(
      c.req.param("id") as LicenseId,
      body.reason ?? "Revoked by creator."
    );
    return c.json(revocation, 201);
  });

  app.get("/api/licenses/:id/verify", async (c) =>
    c.json(await service.verifyLicenseRecord(c.req.param("id") as LicenseId))
  );

  app.get("/api/receipts/:id/bundle", async (c) => {
    const bundle = await service.getReceiptBundle(c.req.param("id") as ProofReceiptId);
    if (!bundle) return c.json({ error: "Receipt not found." }, 404);
    return c.json(bundle);
  });

  app.post("/api/trace", async (c) => {
    const body = await c.req.json<{ artifactB64: string }>();
    if (typeof body.artifactB64 !== "string" || body.artifactB64.length === 0) {
      return c.json({ error: "Provide the artifact as base64." }, 400);
    }
    if (body.artifactB64.length > 8_000_000) {
      return c.json({ error: "Artifact exceeds the dev trace size limit." }, 413);
    }
    return c.json(await service.trace(base64ToBytes(body.artifactB64)));
  });

  app.get("/api/buyers/:emailHash/library", async (c) => {
    const library = await service.getBuyerLibrary(c.req.param("emailHash"));
    if (!library) return c.json({ error: "No buyer exists for this email." }, 404);
    return c.json(library);
  });

  app.post("/api/admin/reset", async (c) => {
    if (options.adminToken !== undefined) {
      const header = c.req.header("authorization");
      if (header !== `Bearer ${options.adminToken}`) {
        return c.json({ error: "Admin token required." }, 401);
      }
    }
    await service.reset();
    return c.json({ ok: true });
  });

  if (options.staticRoot !== undefined) {
    const root = path.resolve(options.staticRoot);
    app.get("*", async (c) => {
      const requestPath = decodeURIComponent(new URL(c.req.url).pathname);
      if (requestPath.startsWith("/api/")) return c.json({ error: "Not found." }, 404);
      const candidate = path.resolve(path.join(root, requestPath));
      // Traversal guard: never serve outside the static root.
      const target =
        candidate.startsWith(root + path.sep) || candidate === root
          ? candidate
          : path.join(root, "index.html");
      try {
        const filePath = target === root ? path.join(root, "index.html") : target;
        const body = await readFile(filePath);
        const type = STATIC_TYPES[path.extname(filePath)] ?? "application/octet-stream";
        return c.body(new Uint8Array(body), 200, { "Content-Type": type });
      } catch {
        // SPA fallback: client-side routes (e.g. /verify/<receiptId>) get index.html.
        const index = await readFile(path.join(root, "index.html"));
        return c.body(new Uint8Array(index), 200, {
          "Content-Type": "text/html; charset=utf-8"
        });
      }
    });
  }

  return app;
}
