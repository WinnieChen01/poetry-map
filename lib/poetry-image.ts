import sharp from "sharp";

/** Fetch only this project's image bucket; never follow arbitrary image URLs. */
export async function poetryImage(imageUrl: string) {
  const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const url = new URL(imageUrl);
  if (url.origin !== base.origin || !url.pathname.startsWith("/storage/v1/object/public/meme-images/") || url.username || url.password) throw new Error("Unsupported image source");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("Image unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error("Image too large"); }
    chunks.push(value);
  }
  const bytes = await sharp(Buffer.concat(chunks), { limitInputPixels: 25000000 }).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { inlineData: { mimeType: "image/jpeg", data: bytes.toString("base64") } };
}
