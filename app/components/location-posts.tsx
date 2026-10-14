"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import MemoryCard from "./memory-card";
import VoteButtons from "./vote-buttons";
import styles from "../page.module.css";
type Post = { id: string; created_at: string; caption: string; generation_id: string | null; score: number; images: { image_url: string; description: string } | null };
type Result = { posts: Post[]; votes: { post_id: string; value: number }[]; signedIn: boolean; hasMore: boolean };
export default function LocationPosts({ location, onCreate }: { location: string; onCreate: () => void }) {
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/location-posts?location=${encodeURIComponent(location)}&page=${page}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Couldn’t load posts."); });
    return () => controller.abort();
  }, [location, page, retry]);
  function changePage(next: number) { setResult(null); setError(""); setPage(next); }
  return <section className={styles.newspaper} aria-labelledby="location-posts-heading">
    <div className={styles.locationPostHeader}><h1 id="location-posts-heading">{location}</h1><button className={styles.authButton} onClick={onCreate}>+ New post here</button></div>
    {!result && !error && <p role="status">Loading posts…</p>}
    {error && <p role="alert">{error} <button onClick={() => { setError(""); setRetry(value => value + 1); }}>Retry</button></p>}
    {result && <>
      {!result.posts.length && <p className={styles.notice}>No posts here yet. Be the first.</p>}
      <ul className={styles.grid} tabIndex={0} aria-label="Memory posts">{result.posts.map(post => <li key={post.id}><MemoryCard createdAt={post.created_at}>
        <div className={styles.cardText}><h2 className={styles.poemText}>{post.caption}</h2></div>
        {post.images && <Image src={post.images.image_url} alt={post.images.description} width={640} height={640} unoptimized className={styles.image} />}
        <VoteButtons postId={post.id} signedIn={result.signedIn} initialScore={post.score} initialValue={result.votes.find(vote => vote.post_id === post.id)?.value ?? 0} />
      </MemoryCard></li>)}</ul>
      <div className={styles.composerActions}>
        {page > 0 && <button onClick={() => changePage(page - 1)}>Previous</button>}
        {result.hasMore && <button onClick={() => changePage(page + 1)}>Next</button>}
      </div>
    </>}
  </section>;
}
