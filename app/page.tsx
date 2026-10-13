import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PostFeed, { type FeedPost } from "./components/post-feed";
import CampusMap from "./components/campus-map";
import AccountHeader from "./components/account-header";
import { hasCompleteName } from "@/lib/profile";
import { createAuthClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Memory Diary | Winnie Chen",
  description: "Photos, feelings, and three-line poems tied to places.",
};

export default async function PostsPage() {
  await connection();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, caption, generation_id, location, score, created_at, images(image_url, description)")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(60)
    .abortSignal(AbortSignal.timeout(10000))
    .returns<FeedPost[]>();

  if (error) {
    // Keep connection details and database errors out of the rendered page.
    throw new Error("Unable to load posts from Supabase.");
  }

  const posts = data ?? [];
  const auth = await createAuthClient();
  const { data: { user } } = await auth.auth.getUser();

  if (user) {
    const { data: profile } = await auth.from("profiles").select("id,first_name,last_name,avatar_path").eq("id", user.id).maybeSingle();
    if (!hasCompleteName(profile)) redirect("/profile");
  }

  const { data: images, error: imagesError } = await supabase.from("images").select("id,image_url,description");
  if (imagesError) throw new Error("Unable to load images.");
  const { data: votes } = user ? await auth.from("votes").select("post_id,value").eq("user_id", user.id) : { data: [] };
  const myVotes = Object.fromEntries((votes ?? []).map(vote => [vote.post_id, vote.value])) as Record<string, number>;

  return (
    <main className={`${styles.page} ${styles.mapPage}`}>
      <AccountHeader home />
      <CampusMap signedIn={!!user} images={images ?? []}>
        <section className={styles.newspaper} aria-label="Memory diary feed">
          <PostFeed posts={posts} signedIn={!!user} votes={myVotes} />
        </section>
      </CampusMap>
    </main>
  );
}
