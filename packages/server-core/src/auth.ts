import { bytesEqual, sha256HexOfString, utf8Bytes } from "@my-digital/core";
import type { Session, SessionId, UserId } from "@my-digital/types";
import { argon2id } from "@noble/hashes/argon2";

/**
 * Password + session primitives for the marketplace.
 *
 * - Passwords are hashed with Argon2id (the same KDF family the envelope already
 *   runs on Cloudflare Workers), with an OWASP-recommended cost. The encoded
 *   string is self-describing so parameters can change without a migration.
 * - Sessions are opaque: the browser holds a random token; the database stores
 *   only its SHA-256, so a database read cannot reconstruct a live token.
 */

// OWASP minimum for Argon2id (m=12 MiB, t=3, p=1). Kept modest so it runs well
// within the Worker CPU budget that already executes envelope Argon2id.
const ARGON = { m: 12288, t: 3, p: 1, dkLen: 32 } as const;
const PREFIX = "argon2id";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE = "md_session";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Hashes a password with Argon2id; returns a self-describing encoded string. */
export function hashPassword(password: string): string {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (password.length > 200) {
    throw new Error("Password is too long.");
  }
  const salt = randomBytes(16);
  const hash = argon2id(utf8Bytes(password), salt, ARGON);
  return `${PREFIX}$m=${ARGON.m},t=${ARGON.t},p=${ARGON.p}$${bytesToB64url(salt)}$${bytesToB64url(hash)}`;
}

/** Constant-time password verification against an encoded Argon2id hash. */
export function verifyPassword(password: string, encoded: string): boolean {
  const [prefix, paramStr, saltB64, hashB64] = encoded.split("$");
  if (!prefix || !paramStr || !saltB64 || !hashB64 || prefix !== PREFIX) return false;
  const params = /^m=(\d+),t=(\d+),p=(\d+)$/.exec(paramStr);
  if (!params) return false;
  const [, mStr, tStr, pStr] = params;
  if (!mStr || !tStr || !pStr) return false;
  let expected: Uint8Array;
  let salt: Uint8Array;
  try {
    salt = b64urlToBytes(saltB64);
    expected = b64urlToBytes(hashB64);
  } catch {
    return false;
  }
  const actual = argon2id(utf8Bytes(password), salt, {
    m: Number(mStr),
    t: Number(tStr),
    p: Number(pStr),
    dkLen: expected.length
  });
  return bytesEqual(actual, expected);
}

/** A freshly minted session and the raw cookie token to hand to the browser. */
export interface IssuedSession {
  token: string;
  session: Session;
}

/** Creates a session record; the raw token is returned only here. */
export async function issueSession(userId: UserId): Promise<IssuedSession> {
  const token = bytesToB64url(randomBytes(32));
  const id = (await sha256HexOfString(token)) as SessionId;
  const now = new Date();
  return {
    token,
    session: {
      id,
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString()
    }
  };
}

/** Maps a raw cookie token to the session id stored in the database. */
export async function sessionIdFromToken(token: string): Promise<SessionId> {
  return (await sha256HexOfString(token)) as SessionId;
}

export const SESSION_MAX_AGE_SEC = Math.floor(SESSION_TTL_MS / 1000);

/** Reads a single cookie value from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/** Serializes the session cookie (HttpOnly, SameSite=Lax, Secure in production). */
export function serializeSessionCookie(
  token: string,
  options: { secure: boolean; maxAgeSec?: number }
): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSec ?? SESSION_MAX_AGE_SEC}`
  ];
  if (options.secure) attrs.push("Secure");
  return attrs.join("; ");
}

/** Serializes a cookie that immediately clears the session. */
export function clearSessionCookie(options: { secure: boolean }): string {
  const attrs = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (options.secure) attrs.push("Secure");
  return attrs.join("; ");
}
