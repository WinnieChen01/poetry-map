import { revalidatePath } from "next/cache";
import { isCampusLocation } from "@/lib/campus-buildings";
import { mutation, reply, uuid } from "@/lib/mutation";

/** Edits the caption/location of one of the signed-in user's posts. */
export async function PATCH(request: Request) {
  const context = await mutation(request);
  if (context.error) return context.error;
  const { db, body } = context;
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  if (!uuid(body.postId) || !caption || caption.length > 300 || location.length > 100 || !isCampusLocation(location)) return reply({ error: "Enter a caption (up to 300 characters) and choose a building from the map." }, 400);
  // RLS limits the update to posts owned by the caller, so a foreign id matches no row.
  const { data, error } = await db.from("posts").update({ caption, location: location || null }).eq("id", body.postId).select("id").single();
  if (error || !data) return reply({ error: "Couldn’t update this post. Please try again." }, 503);
  revalidatePath("/");
  return reply({ success: true });
}

/** Deletes one of the signed-in user's posts. */
export async function DELETE(request: Request) {
  const context = await mutation(request);
  if (context.error) return context.error;
  const { db, body } = context;
  if (!uuid(body.postId)) return reply({ error: "Invalid post." }, 400);
  const { data, error } = await db.from("posts").delete().eq("id", body.postId).select("id").single();
  if (error || !data) return reply({ error: "Couldn’t delete this post. Please try again." }, 503);
  revalidatePath("/");
  return reply({ success: true });
}
