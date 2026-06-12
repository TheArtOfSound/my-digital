import { base64ToBytes } from "@my-digital/core";
import { QEV_VAULT_SCHEMA } from "@my-digital/envelope";
import type {
  LicenseId,
  LicenseTerms,
  ListingId,
  LockedAssetId,
  ProofReceiptId
} from "@my-digital/types";
import { Hono } from "hono";
import type { MarketplaceService } from "./service";

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

export function createApp(service: MarketplaceService): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 400);
  });

  app.get("/api/health", (c) =>
    c.json({ ok: true, envelope: QEV_VAULT_SCHEMA, payments: "mock" })
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
    await service.reset();
    return c.json({ ok: true });
  });

  return app;
}
