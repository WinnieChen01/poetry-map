"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MemoryCard from "../components/memory-card";
import LocationPicker from "../components/location-picker";
import styles from "../page.module.css";

export type MyPost = {
  id: string;
  caption: string;
  created_at: string;
  location: string | null;
  score: number;
  images: { image_url: string; description: string } | null;
};

export default function MyPosts({ posts }: { posts: MyPost[] }) {
  const router = useRouter();
  const locationDialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState<"saving" | "deleting" | "">("");
  const [error, setError] = useState("");

  function startEdit(post: MyPost) {
    setEditing(post.id);
    setCaption(post.caption);
    setLocation(post.location ?? "");
    setError("");
  }

  async function save(postId: string) {
    if (busy) return;
    setBusy("saving"); setError("");
    try {
      const response = await fetch("/api/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, caption, location }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t update this post.");
      setEditing(null);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t update this post."); }
    finally { setBusy(""); }
  }

  async function remove(postId: string) {
    if (busy || !window.confirm("Delete this post? This can’t be undone.")) return;
    setBusy("deleting"); setError("");
    try {
      const response = await fetch("/api/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t delete this post.");
      setEditing(null);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t delete this post."); }
    finally { setBusy(""); }
  }

  if (!posts.length) return <p className={styles.notice}>You haven’t posted yet. Use “+new” on the map to save your first poem.</p>;

  return <>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <ul className={styles.myPostGrid}>
      {posts.map(post => <li key={post.id}>
        <MemoryCard createdAt={post.created_at}>
          <div className={styles.myPostImage}>
            {post.images ? <Image src={post.images.image_url} alt={post.images.description} width={400} height={400} unoptimized /> : <p className={styles.notice}>Image unavailable</p>}
          </div>
          {editing === post.id ? <div className={styles.myPostEdit}>
            <label>Poem<textarea value={caption} maxLength={300} rows={3} disabled={!!busy} onChange={event => setCaption(event.target.value)} /></label>
            <div className={styles.myPostLocation}>
              <span>Location</span>
              <button type="button" disabled={!!busy} onClick={() => locationDialog.current?.showModal()}>{location || "Choose on the map"}</button>
            </div>
            <div className={styles.myPostActions}>
              <button type="button" disabled={!!busy || !caption.trim()} onClick={() => void save(post.id)}>{busy === "saving" ? "Saving…" : "Save changes"}</button>
              <button type="button" disabled={!!busy} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div> : <div className={styles.myPostBody}>
            <h2 className={styles.poemText}>{post.caption}</h2>
            <p className={styles.myPostMeta}>{post.location || "No location"}</p>
            <div className={styles.myPostActions}>
              <button type="button" disabled={!!busy} onClick={() => startEdit(post)}>Edit</button>
              <button type="button" disabled={!!busy} onClick={() => void remove(post.id)}>{busy === "deleting" ? "Deleting…" : "Delete"}</button>
              <span className={styles.myPostScore} aria-label={`Vote score: ${post.score}`}><span aria-hidden="true">▲</span><span>{post.score}</span><span aria-hidden="true">▼</span></span>
            </div>
          </div>}
        </MemoryCard>
      </li>)}
    </ul>
    <dialog ref={locationDialog} className={styles.locationDialog} onClick={event => { if (event.target === event.currentTarget) locationDialog.current?.close(); }}>
      <div className={styles.profileDialogInner}>
        <button type="button" className={styles.composeClose} aria-label="Close location picker" onClick={() => locationDialog.current?.close()}>×</button>
        <h2>Where is this post?</h2>
        <LocationPicker value={location} onSelect={name => { setLocation(name); locationDialog.current?.close(); }} />
        <div className={styles.locationDialogActions}>
          <button type="button" onClick={() => { setLocation(""); locationDialog.current?.close(); }}>Clear location</button>
          <button type="button" onClick={() => locationDialog.current?.close()}>Cancel</button>
        </div>
      </div>
    </dialog>
  </>;
}
