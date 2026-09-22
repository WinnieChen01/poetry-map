import type { Metadata } from "next";
import Image from "next/image";
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
  images: { image_url: string; description: string } | null;
};

export default async function PostsPage() {
  await connection();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, caption, images(image_url, description)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .abortSignal(AbortSignal.timeout(10000))
    .returns<Post[]>();

  if (error) {
    // Keep connection details and database errors out of the rendered page.
    throw new Error("Unable to load posts from Supabase.");
  }

  const posts = data ?? [];

  return (
    <main className={styles.page}>
      <header className={styles.userHeader}>
        <span>Winnie Chen</span>
      </header>
      <section aria-labelledby="posts-heading">
        <div className={styles.sectionHeading}>
          <h1 id="posts-heading">Latest posts</h1>
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
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
