import { utf8Bytes } from "./encoding";

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy so any Uint8Array view satisfies BufferSource under TS 5.7 generic typed arrays.
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256HexOfString(text: string): Promise<string> {
  return sha256Hex(utf8Bytes(text));
}
