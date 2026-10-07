import { createAuthClient } from "@/lib/supabase/server";
import { isCampusLocation } from "@/lib/campus-buildings";
import { reply } from "@/lib/mutation";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const location = params.get("location") || "";
  const page = Number(params.get("page") || 0);
  if (!location || !isCampusLocation(location) || !Number.isSafeInteger(page) || page < 0 || page > 100000) return reply({ error: "Invalid location." }, 400);
  const db = await createAuthClient();
  const { data: { user } } = await db.auth.getUser();
  const { data, error } = await db.from("posts").select("id,caption,generation_id,score,images(image_url,description)").eq("location", location).order("created_at", { ascending: false }).order("id").range(page * 12, page * 12 + 12);
  if (error) return reply({ error: "Couldn’t load posts. Please retry." }, 503);
  const posts = data.slice(0, 12);
  const { data: votes, error: voteError } = user && posts.length ? await db.from("votes").select("post_id,value").eq("user_id", user.id).in("post_id", posts.map(post => post.id)) : { data: [], error: null };
  if (voteError) return reply({ error: "Couldn’t load your votes. Please retry." }, 503);
  return reply({ posts, votes, signedIn: !!user, hasMore: data.length > 12 });
}
