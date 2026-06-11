export interface DemoCryptoSupport {
  supported: boolean;
  reason?: string;
}

export async function checkDemoCryptoSupport(): Promise<DemoCryptoSupport> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return {
      supported: false,
      reason:
        "The WebCrypto subtle API is unavailable. The demo requires a secure context (localhost or HTTPS)."
    };
  }
  try {
    await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    return { supported: true };
  } catch {
    return {
      supported: false,
      reason:
        "This browser does not support Ed25519 in WebCrypto. Use a current version of Chrome, Safari, or Firefox."
    };
  }
}
