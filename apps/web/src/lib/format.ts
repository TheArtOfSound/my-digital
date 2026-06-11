export function formatPrice(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      amountCents / 100
    );
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

export function shortId(value: string, length = 22): string {
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

export function shortHash(value: string, length = 16): string {
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

export function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString();
}

export function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  downloadBlob(fileName, blob);
}

export function downloadBytes(fileName: string, mimeType: string, bytes: Uint8Array): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType || "application/octet-stream" });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
