"use client";

import { useState } from "react";
import Image from "next/image";
import VoteButtons from "./vote-buttons";
import styles from "../page.module.css";

export type FeedPost = {
  id: string;
  caption: string;
  generation_id: string | null;
  location: string | null;
  score: number;
  created_at: string;
  images: { image_url: string; description: string } | null;
};

export default function PostFeed({ posts, signedIn, votes }: { posts: FeedPost[]; signedIn: boolean; votes: Record<string, number> }) {
  const [tab, setTab] = useState<"trending" | "new">("trending");
  // The server already returns trend order; "new" only needs a client-side sort.
  const ordered = tab === "new"
    ? [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.id.localeCompare(a.id))
    : posts;
  return <>
    <div className={styles.feedTabs} role="tablist" aria-label="Post feeds">
      <button type="button" role="tab" aria-selected={tab === "trending"} onClick={() => setTab("trending")}>trending</button>
      <button type="button" role="tab" aria-selected={tab === "new"} onClick={() => setTab("new")}>new</button>
      <span className={styles.feedCount}>{ordered.length} {ordered.length === 1 ? "post" : "posts"}</span>
    </div>
    {ordered.length === 0 ? (
      <p className={styles.notice}>No memories yet. Create a poem from a moment you want to keep.</p>
    ) : (
      <ul className={styles.grid}>
        {ordered.map(post => (
          <li key={post.id}>
            <article className={styles.card}>
              <div className={styles.cardText}>
                <h2 className={styles.poemText}>{post.caption}</h2>
                {post.generation_id && <small>AI-assisted{post.location ? ` · ${post.location}` : ""}</small>}
              </div>
              {post.images ? (
                <Image src={post.images.image_url} alt={post.images.description} width={640} height={640} unoptimized className={styles.image} />
              ) : (
                <p className={styles.notice}>Image unavailable</p>
              )}
              <VoteButtons postId={post.id} signedIn={signedIn} initialValue={votes[post.id] ?? 0} initialScore={post.score} />
            </article>
          </li>
        ))}
      </ul>
    )}
  </>;
}
