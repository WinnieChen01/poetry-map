import { revalidatePath } from "next/cache";
import { mutation, reply, uuid } from "@/lib/mutation";
export async function POST(request: Request) {
  const context = await mutation(request);
  if (context.error) return context.error;
  const { db, user, body } = context;
  if (!uuid(body.generationId)) return reply({ error: "Invalid caption." }, 400);
  const { data: generation } = await db.from("generations").select("id,image_id,caption,location").eq("id", body.generationId).eq("user_id", user.id).single();
  if (!generation?.caption) return reply({ error: "Caption unavailable. Generate one first." }, 404);
  const { error } = await db.from("posts").insert({ generation_id: generation.id, image_id: generation.image_id, caption: generation.caption, location: generation.location });
  if (error && error.code !== "23505") return reply({ error: "Couldn’t publish. Your caption is still saved; please retry." }, 503);
  revalidatePath("/");
  return reply({ success: true });
}
