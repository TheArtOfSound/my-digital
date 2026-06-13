import { decryptVaultV2, encryptVaultV2 } from "@bryan237l/qev-cli";
import { bytesEqual, utf8Bytes } from "@my-digital/core";
import type { AssetVersionId, LicenseId } from "@my-digital/types";
import { describe, expect, it } from "vitest";
import { nobleCryptoProvider } from "./qev-crypto";
import { MYDIGITAL_INNER_KIND, QEV_VAULT_SCHEMA, QevVaultV2EnvelopeAdapter } from "./qev-vault-v2";

// "quick" preset keeps Argon2id costs test-friendly; format is identical
// across presets, only the KDF cost parameters differ.
const adapter = new QevVaultV2EnvelopeAdapter({ preset: "quick" });

const PLAINTEXT = utf8Bytes("Real crypto payload for the QEV Vault V2 adapter tests.");
const CODE = "UNLK-AAAA-BBBB-CCCC-DDDD";
const LICENSE_ID = "license_qev-test" as LicenseId;

const lockInput = {
  assetVersionId: "assetver_qev-test" as AssetVersionId,
  fileName: "asset.txt",
  mimeType: "text/plain",
  plaintext: PLAINTEXT
};

async function lockAndWrap() {
  const lockResult = await adapter.lock(lockInput);
  if (lockResult.keyMaterialB64 === undefined) throw new Error("missing custody key");
  const wrap = await adapter.wrapForCredential({
    lockedPayload: lockResult.lockedPayload,
    keyMaterialB64: lockResult.keyMaterialB64,
    credential: CODE,
    licenseId: LICENSE_ID
  });
  return { lockResult, wrap };
}

function parseVault(bytes: Uint8Array): Record<string, never> & {
  schema: string;
  version: string;
  created_at: string;
  mode: string;
  kdf: { algorithm: string; opslimit: number; memlimit: number; salt: string };
  wrap: { algorithm: string; nonce: string; wrapped_key: string };
  content: { algorithm: string; nonce: string; ciphertext: string };
} {
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe("QevVaultV2EnvelopeAdapter.lock", () => {
  it("produces a production (not demo) upstream-format vault", async () => {
    const lockResult = await adapter.lock(lockInput);
    expect(lockResult.developmentOnly).toBe(false);
    expect(lockResult.envelopeFormat).toBe(QEV_VAULT_SCHEMA);
    expect(lockResult.keyMaterialB64).toBeDefined();

    const vault = parseVault(lockResult.lockedPayload);
    expect(vault.schema).toBe("BRY-NFET-SX-VAULT-V2");
    expect(vault.mode).toBe("self");
    expect(vault.kdf.algorithm).toBe("argon2id");
    expect(vault.wrap.algorithm).toBe("XChaCha20-Poly1305");
    expect(vault.content.algorithm).toBe("XChaCha20-Poly1305");
    expect(vault.wrap.wrapped_key.length).toBeGreaterThan(0);
    expect(vault.content.ciphertext.length).toBeGreaterThan(0);
  });
});

describe("QevVaultV2EnvelopeAdapter wrap + unlock", () => {
  it("mints a buyer vault that unlocks with the credential and binds the license", async () => {
    const { wrap } = await lockAndWrap();
    const vault = parseVault(wrap.buyerLockedPayload);
    expect(vault.mode).toBe("share");

    const result = await adapter.unlock({
      lockedPayload: wrap.buyerLockedPayload,
      licenseMaterial: CODE
    });
    expect(result.verification.status).toBe("pass");
    expect(result.verification.warnings).toHaveLength(0);
    expect(bytesEqual(result.plaintext, PLAINTEXT)).toBe(true);
    const codes = result.verification.checksPassed.map((check) => check.code);
    expect(codes).toContain("VAULT_WRAP_AUTH_VERIFIED");
    expect(codes).toContain("VAULT_CONTENT_AUTH_VERIFIED");
    expect(codes).toContain("INNER_CONTENT_HASH_MATCH");
    expect(codes).toContain("INNER_BINDING_PRESENT");
    expect(result.verification.subjectId).toBe(LICENSE_ID);
  });

  it("unlocks the custody vault with the custody key material", async () => {
    const lockResult = await adapter.lock(lockInput);
    const result = await adapter.unlock({
      lockedPayload: lockResult.lockedPayload,
      licenseMaterial: lockResult.keyMaterialB64 ?? ""
    });
    expect(result.verification.status).toBe("pass");
    expect(bytesEqual(result.plaintext, PLAINTEXT)).toBe(true);
    expect(result.verification.subjectId).toBe(lockInput.assetVersionId);
  });

  it("fails cryptographically with the wrong credential and returns no plaintext", async () => {
    const { wrap } = await lockAndWrap();
    const result = await adapter.unlock({
      lockedPayload: wrap.buyerLockedPayload,
      licenseMaterial: "UNLK-WRON-GCOD-EFOR-SURE"
    });
    expect(result.verification.status).toBe("fail");
    expect(result.plaintext.byteLength).toBe(0);
    expect(result.verification.checksFailed.map((check) => check.code)).toContain(
      "VAULT_WRAP_AUTH_FAILED"
    );
  });

  it("fails with CONTENT auth when the ciphertext is tampered (credential still valid)", async () => {
    const { wrap } = await lockAndWrap();
    const vault = parseVault(wrap.buyerLockedPayload);
    const ct = vault.content.ciphertext;
    vault.content.ciphertext = (ct[0] === "A" ? "B" : "A") + ct.slice(1);
    const result = await adapter.unlock({
      lockedPayload: utf8Bytes(JSON.stringify(vault)),
      licenseMaterial: CODE
    });
    expect(result.verification.status).toBe("fail");
    expect(result.verification.checksFailed.map((check) => check.code)).toContain(
      "VAULT_CONTENT_AUTH_FAILED"
    );
  });

  it("fails with WRAP auth when bound metadata is tampered", async () => {
    const { wrap } = await lockAndWrap();
    const vault = parseVault(wrap.buyerLockedPayload);
    vault.created_at = "1999-01-01T00:00:00.000Z";
    const result = await adapter.unlock({
      lockedPayload: utf8Bytes(JSON.stringify(vault)),
      licenseMaterial: CODE
    });
    expect(result.verification.status).toBe("fail");
    expect(result.verification.checksFailed.map((check) => check.code)).toContain(
      "VAULT_WRAP_AUTH_FAILED"
    );
  });

  it("fails structurally on non-vault bytes and empty credentials", async () => {
    const garbage = await adapter.unlock({
      lockedPayload: utf8Bytes("not a vault"),
      licenseMaterial: CODE
    });
    expect(garbage.verification.status).toBe("fail");
    expect(garbage.verification.checksFailed.map((check) => check.code)).toContain(
      "VAULT_PARSE_FAILED"
    );

    const { wrap } = await lockAndWrap();
    const empty = await adapter.unlock({
      lockedPayload: wrap.buyerLockedPayload,
      licenseMaterial: ""
    });
    expect(empty.verification.status).toBe("fail");
    expect(empty.verification.checksFailed.map((check) => check.code)).toContain(
      "MISSING_LICENSE_MATERIAL"
    );
  });
});

describe("QevVaultV2EnvelopeAdapter.verifyVaultStructure", () => {
  it("passes a well-formed buyer vault", async () => {
    const { wrap } = await lockAndWrap();
    const result = await adapter.verifyVaultStructure(wrap.buyerLockedPayload);
    expect(result.status).toBe("pass");
    const codes = result.checksPassed.map((check) => check.code);
    expect(codes).toContain("VAULT_SCHEMA_VALID");
    expect(codes).toContain("VAULT_KDF_PARAMS_VALID");
    expect(codes).toContain("VAULT_FIELD_LENGTHS_VALID");
  });

  it("fails on a wrong schema identifier", async () => {
    const { wrap } = await lockAndWrap();
    const vault = parseVault(wrap.buyerLockedPayload);
    (vault as { schema: string }).schema = "SOME-OTHER-SCHEMA";
    const result = await adapter.verifyVaultStructure(utf8Bytes(JSON.stringify(vault)));
    expect(result.status).toBe("fail");
    expect(result.checksFailed.map((check) => check.code)).toContain("VAULT_SCHEMA_UNSUPPORTED");
  });

  it("fails on out-of-range KDF parameters", async () => {
    const { wrap } = await lockAndWrap();
    const vault = parseVault(wrap.buyerLockedPayload);
    vault.kdf.opslimit = 99;
    const result = await adapter.verifyVaultStructure(utf8Bytes(JSON.stringify(vault)));
    expect(result.status).toBe("fail");
    expect(result.checksFailed.map((check) => check.code)).toContain(
      "VAULT_KDF_PARAMS_OUT_OF_RANGE"
    );
  });
});

describe("noble crypto backend (Workers runtime)", () => {
  const noble = new QevVaultV2EnvelopeAdapter({ preset: "edge", crypto: nobleCryptoProvider });

  it("locks, wraps, and unlocks with pure-JS crypto", async () => {
    const lockResult = await noble.lock(lockInput);
    expect(lockResult.developmentOnly).toBe(false);
    expect(lockResult.qevEngineVersion).toContain("noble");
    const wrap = await noble.wrapForCredential({
      lockedPayload: lockResult.lockedPayload,
      keyMaterialB64: lockResult.keyMaterialB64 ?? "",
      credential: CODE,
      licenseId: LICENSE_ID
    });
    const unlocked = await noble.unlock({
      lockedPayload: wrap.buyerLockedPayload,
      licenseMaterial: CODE
    });
    expect(unlocked.verification.status).toBe("pass");
    expect(bytesEqual(unlocked.plaintext, PLAINTEXT)).toBe(true);

    const wrong = await noble.unlock({
      lockedPayload: wrap.buyerLockedPayload,
      licenseMaterial: "UNLK-WRON-GCOD-EFOR-SURE"
    });
    expect(wrong.verification.status).toBe("fail");
  });

  it("is byte-compatible with the sodium backend in both directions", async () => {
    const sodium = new QevVaultV2EnvelopeAdapter({ preset: "edge" });

    // sodium-locked custody vault wrapped by noble, unlocked by sodium.
    const sodiumLock = await sodium.lock(lockInput);
    const nobleWrap = await noble.wrapForCredential({
      lockedPayload: sodiumLock.lockedPayload,
      keyMaterialB64: sodiumLock.keyMaterialB64 ?? "",
      credential: CODE,
      licenseId: LICENSE_ID
    });
    const sodiumUnlock = await sodium.unlock({
      lockedPayload: nobleWrap.buyerLockedPayload,
      licenseMaterial: CODE
    });
    expect(sodiumUnlock.verification.status).toBe("pass");
    expect(bytesEqual(sodiumUnlock.plaintext, PLAINTEXT)).toBe(true);

    // noble-locked custody vault unlocked by sodium with the custody key.
    const nobleLock = await noble.lock(lockInput);
    const crossUnlock = await sodium.unlock({
      lockedPayload: nobleLock.lockedPayload,
      licenseMaterial: nobleLock.keyMaterialB64 ?? ""
    });
    expect(crossUnlock.verification.status).toBe("pass");
  });

  it("noble-minted buyer vaults decrypt with the upstream qev CLI", async () => {
    const lockResult = await noble.lock(lockInput);
    const wrap = await noble.wrapForCredential({
      lockedPayload: lockResult.lockedPayload,
      keyMaterialB64: lockResult.keyMaterialB64 ?? "",
      credential: CODE,
      licenseId: LICENSE_ID
    });
    const vault = JSON.parse(new TextDecoder().decode(wrap.buyerLockedPayload)) as object;
    const innerText = (await decryptVaultV2({ vault, password: CODE })) as string;
    const inner = JSON.parse(innerText) as { kind: string; binding: { license_id?: string } };
    expect(inner.kind).toBe(MYDIGITAL_INNER_KIND);
    expect(inner.binding.license_id).toBe(LICENSE_ID);
  });

  it("upstream-encrypted vaults unlock with the noble backend", async () => {
    const upstreamVault = (await encryptVaultV2({
      plaintext: "upstream to noble",
      password: "a long enough upstream phrase",
      mode: "self",
      opslimit: 1,
      memlimit: 32 * 1024 * 1024
    })) as object;
    const result = await noble.unlock({
      lockedPayload: utf8Bytes(JSON.stringify(upstreamVault)),
      licenseMaterial: "a long enough upstream phrase"
    });
    expect(result.verification.status).toBe("pass");
    expect(new TextDecoder().decode(result.plaintext)).toBe("upstream to noble");
  });
});

describe("cross-implementation compatibility with @bryan237l/qev-cli", () => {
  it("a buyer vault minted here decrypts with the upstream implementation", async () => {
    const { wrap } = await lockAndWrap();
    const vault = JSON.parse(new TextDecoder().decode(wrap.buyerLockedPayload)) as object;
    const innerText = (await decryptVaultV2({ vault, password: CODE })) as string;
    const inner = JSON.parse(innerText) as {
      kind: string;
      binding: { license_id?: string; content_sha256: string };
      payload_b64: string;
    };
    expect(inner.kind).toBe(MYDIGITAL_INNER_KIND);
    expect(inner.binding.license_id).toBe(LICENSE_ID);
  });

  it("an upstream-encrypted vault unlocks with this adapter", async () => {
    const upstreamVault = (await encryptVaultV2({
      plaintext: "hello from the upstream QEV implementation",
      password: "a long enough upstream phrase",
      mode: "self",
      opslimit: 1,
      memlimit: 32 * 1024 * 1024
    })) as object;
    const result = await adapter.unlock({
      lockedPayload: utf8Bytes(JSON.stringify(upstreamVault)),
      licenseMaterial: "a long enough upstream phrase"
    });
    expect(result.verification.status).toBe("pass");
    expect(new TextDecoder().decode(result.plaintext)).toBe(
      "hello from the upstream QEV implementation"
    );
    expect(result.verification.checksSkipped.map((check) => check.code)).toContain(
      "INNER_BINDING_ABSENT"
    );
  });
});
