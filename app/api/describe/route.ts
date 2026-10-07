import { describeImage } from "@/lib/gemini";
import { createAuthClient } from "@/lib/supabase/server";
import { imageType } from "@/lib/profile-validation";
import { reply } from "@/lib/mutation";

export const maxDuration = 120;

/** Generates a short library description for an uploaded image using Gemini vision. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  const db = await createAuthClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return reply({ error: "Please sign in to describe an image." }, 401);
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
    if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) return reply({ error: "Choose an image under 2 MB." }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type || type.mime !== file.type) return reply({ error: "Choose a valid JPG, PNG, or WebP." }, 400);
    const outcome = await describeImage(bytes, type.mime);
    if ("error" in outcome) return reply({ error: outcome.error }, outcome.status);
    return reply({ description: outcome.text.slice(0, 200) });
  } catch { return reply({ error: "Couldn’t read the image. Please try again." }, 400); }
}
