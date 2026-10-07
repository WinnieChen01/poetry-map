"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { MemeImage } from "./post-composer";
import styles from "../page.module.css";

export default function ImagePicker({ selected, onSelect, onBusy }: { selected: MemeImage | undefined; onSelect: (image: MemeImage) => void; onBusy: (busy: boolean) => void }) {
  const [mode, setMode] = useState<"browse" | "upload">("browse");
  const [images, setImages] = useState<MemeImage[]>([]);
  const [page, setPage] = useState(-1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [description, setDescription] = useState("");
  const lock = useRef(false);
  const previewUrl = useRef("");
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  async function load(next: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/images?page=${next}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setImages(current => next === 0 ? data.images : [...new Map([...current, ...data.images].map((image: MemeImage) => [image.id, image])).values()]);
      setPage(next); setHasMore(data.hasMore);
    } catch { setError("Couldn’t load images. Try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/images?page=0", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      setImages(data.images); setPage(0); setHasMore(data.hasMore);
    }).catch(() => { if (!controller.signal.aborted) setError("Couldn’t load images. Try again."); });
    return () => controller.abort();
  }, []);
  async function upload() {
    if (!file || !description.trim() || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    onBusy(true);
    const form = new FormData(); form.set("image", file); form.set("description", description.trim());
    try {
      const response = await fetch("/api/images", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      onSelect(data.image); setImages(current => [data.image, ...current]); setFile(null); setPreview(""); setDescription(""); setMode("browse");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t upload. Please retry."); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  return <section aria-label="Choose a meme image">
    <div className={styles.imageOptions}>
      <button type="button" aria-pressed={mode === "upload"} disabled={busy} onClick={() => { setMode("upload"); setError(""); }}>Upload image</button>
      <button type="button" aria-pressed={mode === "browse"} disabled={busy} onClick={() => { setMode("browse"); setError(""); }}>Browse images</button>
    </div>
    {mode === "browse" ? <>
      <div className={styles.imageLibrary} aria-label="Image library" aria-busy={busy}>
        {images.map(image => <button key={image.id} type="button" disabled={busy} aria-label={`Choose ${image.description}`} aria-pressed={selected?.id === image.id} onClick={() => onSelect(image)}><Image src={image.image_url} alt={image.description} width={140} height={110} unoptimized /><span>{image.description}</span></button>)}
      </div>
      {!busy && page >= 0 && !images.length && <p>No images yet. Upload the first one.</p>}
      {(hasMore || page === -1 || error) && <button type="button" disabled={busy} onClick={() => void load(page + 1)}>{busy ? "Loading…" : error ? "Retry" : "Load more"}</button>}
    </> : <>
      <label>Choose image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => {
        const next = event.target.files?.[0]; setError("");
        if (!next) return;
        if (next.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("Choose a JPG, PNG, or WebP under 2 MB."); event.target.value = ""; return; }
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = URL.createObjectURL(next); setPreview(previewUrl.current); setFile(next);
      }} /></label>
      {preview && <Image className={styles.uploadPreview} src={preview} alt="Upload preview" width={300} height={180} unoptimized />}
      <label>Image description<input type="text" value={description} maxLength={200} disabled={busy} onChange={event => setDescription(event.target.value)} placeholder="What’s in the image?" /></label>
      <p className={styles.hint}>JPG, PNG or WebP · Up to 2 MB. Uploads are public and available in the image library.</p>
      <button type="button" disabled={busy || !file || !description.trim()} onClick={() => void upload()}>{busy ? "Uploading…" : "Upload & select"}</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
