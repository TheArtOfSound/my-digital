/**
 * Reads an image file and downscales it to a small JPEG data URL suitable for
 * an avatar. Keeps the stored profile picture well under the server's size cap
 * without needing object storage.
 */
export async function fileToAvatarDataUrl(file: File, max = 256): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (PNG, JPEG, WebP, or GIF).");
  }
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("That file is not a readable image."));
    element.src = sourceUrl;
  });
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image resizing is not supported in this browser.");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
