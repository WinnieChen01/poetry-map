import { mutation, reply, uuid } from "@/lib/mutation";
export async function POST(request: Request) {
  const context = await mutation(request);
  if (context.error) return context.error;
  const { db, user, body } = context;
  if (!uuid(body.postId) || ![-1, 0, 1].includes(body.value)) return reply({ error: "Invalid vote." }, 400);
  // Any existing post can be voted on, including the original non-AI posts.
  const { data: post } = await db.from("posts").select("id").eq("id", body.postId).maybeSingle();
  if (!post) return reply({ error: "This post is unavailable for voting." }, 404);
  let error;
  if (body.value === 0) {
    ({ error } = await db.from("votes").delete().eq("user_id", user.id).eq("post_id", body.postId));
  } else {
    ({ error } = await db.from("votes").insert({ user_id: user.id, post_id: body.postId, value: body.value }));
    if (error?.code === "23505") {
      ({ error } = await db.from("votes").update({ value: body.value }).eq("user_id", user.id).eq("post_id", body.postId));
    }
  }
  if (error) return reply({ error: "Couldn’t save your vote. Please retry." }, 503);
  const { data: updated } = await db.from("posts").select("score").eq("id", body.postId).single();
  return reply({ value: body.value, score: updated?.score });
}
