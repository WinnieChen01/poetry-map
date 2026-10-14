import sharp from "sharp";
import { createAuthClient } from "@/lib/supabase/server";
import { imageType } from "@/lib/profile-validation";
import { reply } from "@/lib/mutation";

export const maxDuration = 120;

export async function GET(request: Request) {
  const db = await createAuthClient();
  const page = Number(new URL(request.url).searchParams.get("page") || 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return reply({ error: "Invalid page." }, 400);
  const { data, error } = await db.from("images").select("id,image_url,description").order("created_at", { ascending: false }).order("id").range(page * 24, page * 24 + 24);
  if (error) return reply({ error: "Couldn’t load images. Please retry." }, 503);
  return reply({ images: data.slice(0, 24), hasMore: data.length > 24 });
}

export async function POST(request: Request) {
  try { return await uploadImage(request); }
  catch {
    console.error("Image upload failed unexpectedly");
    return reply({ error: "Upload is temporarily unavailable. Your photo is still selected; please retry." }, 503);
  }
}

async function uploadImage(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  const db = await createAuthClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return reply({ error: "Please sign in to upload." }, 401);
  // Bound the streamed body too: Content-Length alone is not trustworthy.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Choose an image." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024 + 16384) { await reader.cancel(); return reply({ error: "Choose an image under 2 MB." }, 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("image");
    const descriptionValue = form.get("description");
    let descriptionText = typeof descriptionValue === "string" ? descriptionValue.trim() : "";
    if (descriptionText.length > 200) return reply({ error: "Keep the description under 200 characters." }, 400);
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) return reply({ error: "Choose an image under 2 MB." }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type || type.mime !== file.type) return reply({ error: "Choose a valid JPG, PNG, or WebP." }, 400);
    let normalized: Buffer;
    try {
      normalized = await sharp(bytes, { limitInputPixels: 25000000, failOn: "warning" }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { return reply({ error: "This image couldn’t be opened. Try a smaller JPG, PNG, or WebP." }, 400); }
    if (normalized.byteLength > 2 * 1024 * 1024) return reply({ error: "This image is too large after processing. Choose a smaller image." }, 400);
    // Uploads must not wait for an AI provider. Poetry reads the image itself.
    if (!descriptionText) descriptionText = "Uploaded photo";
    const path = `${user.id}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await db.storage.from("meme-images").upload(path, normalized, { contentType: "image/webp", upsert: false });
    if (uploadError) return reply({ error: "Upload unavailable. Please check image storage permissions." }, 503);
    const { data: { publicUrl } } = db.storage.from("meme-images").getPublicUrl(path);
    const { data, error } = await db.from("images").insert({ image_url: publicUrl, description: descriptionText, user_id: user.id, storage_path: path }).select("id,image_url,description").single();
    if (error) {
      await db.storage.from("meme-images").remove([path]);
      return reply({ error: "Couldn’t save this image. Please check image library permissions." }, 503);
    }
    return reply({ image: data });
  } catch { return reply({ error: "Couldn’t read the upload. Please try again." }, 400); }
}
