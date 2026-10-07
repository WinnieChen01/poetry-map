import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import VoteButtons from "./components/vote-buttons";
import CampusMap from "./components/campus-map";
import AccountHeader from "./components/account-header";
import { hasCompleteName } from "@/lib/profile";
import { createAuthClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Humor Study | Winnie Chen",
  description: "A little campus humor, one meme at a time.",
};

type Post = {
  id: string;
  caption: string;
  generation_id: string | null;
  location: string | null;
  score: number;
  images: { image_url: string; description: string } | null;
};

export default async function PostsPage() {
  await connection();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, caption, generation_id, location, score, images(image_url, description)")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(60)
    .abortSignal(AbortSignal.timeout(10000))
    .returns<Post[]>();

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
  if (imagesError) throw new Error("Unable to load meme images.");
  const { data: votes } = user ? await auth.from("votes").select("post_id,value").eq("user_id", user.id) : { data: [] };
  const myVotes = new Map((votes ?? []).map(vote => [vote.post_id, vote.value]));

  return (
    <main className={`${styles.page} ${styles.mapPage}`}>
      <AccountHeader home />
      <CampusMap signedIn={!!user} images={images ?? []}>
      <section className={styles.newspaper} aria-labelledby="posts-heading">
        <div className={styles.sectionHeading}>
          <h1 id="posts-heading">trending</h1>
          <span>{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
        </div>
        {posts.length === 0 ? (
          <p className={styles.notice}>No posts yet. Check back soon for a little humor.</p>
        ) : (
          <ul className={styles.grid}>
            {posts.map((post) => (
              <li key={post.id}>
                <article className={styles.card}>
                  <div className={styles.cardText}>
                    <h2>{post.caption}</h2>
                    {post.generation_id && <small>AI caption{post.location ? ` · ${post.location}` : ""}</small>}
                  </div>
                  {post.images ? (
                    <Image
                      src={post.images.image_url}
                      alt={post.images.description}
                      width={640}
                      height={640}
                      unoptimized
                      className={styles.image}
                    />
                  ) : (
                    <p className={styles.notice}>Image unavailable</p>
                  )}
                  <VoteButtons postId={post.id} signedIn={!!user} initialValue={myVotes.get(post.id) ?? 0} initialScore={post.score} />
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
      </CampusMap>
    </main>
  );
}
