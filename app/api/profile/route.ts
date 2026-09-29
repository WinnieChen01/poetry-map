import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server";
import { imageType, validateNames } from "@/lib/profile-validation";

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Invalid request origin." }, 403);
  const supabase = await createAuthClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return reply({ error: "Please sign in again before saving." }, 401);
  if (Number(request.headers.get("content-length")) > 3 * 1024 * 1024) return reply({ error: "Please choose an image under 2 MB." }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return reply({ error: "Invalid form submission." }, 400); }
  const names = validateNames(form.get("first_name"), form.get("last_name"));
  if (!names) return reply({ error: "Enter both names, using no more than 80 characters each." }, 400);
  const { data: current, error: readError } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  if (readError) return reply({ error: "Your profile couldn’t be loaded. Please check profile access and try again." }, 503);
  const file = form.get("photo");
  let newPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) return reply({ error: "Please choose an image under 2 MB." }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type || type.mime !== file.type) return reply({ error: "Please upload a valid JPG, PNG or WebP image." }, 400);
    newPath = `${user.id}/${crypto.randomUUID()}.${type.ext}`;
    const { error } = await supabase.storage.from("avatars").upload(newPath, bytes, { contentType: type.mime, upsert: false });
    if (error) return reply({ error: "Photo upload failed. Your changes haven’t been saved; please try again after checking photo storage access." }, 503);
  }
  const { data: updated, error } = await supabase.from("profiles")
    .update({ ...names, ...(newPath ? { avatar_path: newPath } : {}) }).eq("id", user.id).select("id").single();
  if (error || !updated) {
    if (newPath) await supabase.storage.from("avatars").remove([newPath]);
    return reply({ error: "Your changes couldn’t be saved. Please check profile access and try again." }, 503);
  }
  if (newPath && current.avatar_path?.startsWith(`${user.id}/`)) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }
  revalidatePath("/", "layout");
  return reply({ success: true });
}
