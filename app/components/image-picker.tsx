"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import type { MemeImage } from "./post-composer";
import styles from "../page.module.css";

type ImagePickerMode = "browse" | "upload";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export default function ImagePicker({ selected, onSelect, onBusy, mode, onModeChange }: {
  selected: MemeImage | undefined;
  onSelect: (image: MemeImage) => void;
  onBusy: (busy: boolean) => void;
  mode: ImagePickerMode;
  onModeChange: (mode: ImagePickerMode) => void;
}) {
  const [images, setImages] = useState<MemeImage[]>([]);
  const [page, setPage] = useState(-1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [description, setDescription] = useState("");
  const [describing, setDescribing] = useState(false);
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
  async function generateDescription(next: File) {
    setDescribing(true);
    try {
      const form = new FormData(); form.set("image", next);
      const response = await fetch("/api/describe", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t generate a description.");
      if (typeof data.description === "string" && data.description.trim()) setDescription(data.description.trim());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t generate a description."); }
    finally { setDescribing(false); }
  }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]; setError("");
    if (!next) return;
    if (next.size > MAX_BYTES || !ACCEPTED.includes(next.type)) { setError("Choose a JPG, PNG, or WebP under 2 MB."); event.target.value = ""; return; }
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(next); setPreview(previewUrl.current); setFile(next); setDescription("");
    void generateDescription(next);
  }
  async function upload() {
    if (!file || describing || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    onBusy(true);
    const form = new FormData(); form.set("image", file); form.set("description", description.trim());
    try {
      const response = await fetch("/api/images", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      onSelect(data.image); setImages(current => [data.image, ...current]); setFile(null); setPreview(""); setDescription(""); onModeChange("browse");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t upload. Please retry."); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  const working = busy || describing;
  return <section aria-label="Choose a meme image">
    <div className={styles.imageOptions}>
      <button type="button" aria-pressed={mode === "upload"} disabled={working} onClick={() => { onModeChange("upload"); setError(""); }}>Upload image</button>
      <button type="button" aria-pressed={mode === "browse"} disabled={working} onClick={() => { onModeChange("browse"); setError(""); }}>Browse images</button>
    </div>
    {mode === "browse" ? <>
      <div className={styles.imageLibrary} aria-label="Image library" aria-busy={busy}>
        {images.map(image => <button key={image.id} type="button" disabled={busy} aria-label={`Choose ${image.description}`} aria-pressed={selected?.id === image.id} onClick={() => onSelect(image)}><Image src={image.image_url} alt={image.description} width={140} height={110} unoptimized /><span>{image.description}</span></button>)}
      </div>
      {!busy && page >= 0 && !images.length && <p>No images yet. Upload the first one.</p>}
      {(hasMore || page === -1 || error) && <button type="button" disabled={busy} onClick={() => void load(page + 1)}>{busy ? "Loading…" : error ? "Retry" : "Load more"}</button>}
    </> : <>
      <label>Choose image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={working} onChange={chooseFile} /></label>
      {preview && <Image className={styles.uploadPreview} src={preview} alt="Upload preview" width={300} height={180} unoptimized />}
      <label>Image description<input type="text" value={description} maxLength={200} disabled={working} onChange={event => setDescription(event.target.value)} placeholder={describing ? "Generating a description…" : "What’s in the image?"} /></label>
      <p className={styles.hint}>JPG, PNG or WebP · Up to 2 MB. A description is generated automatically and stored with the image.</p>
      <button type="button" disabled={working || !file} onClick={() => void upload()}>{busy ? "Uploading…" : describing ? "Describing…" : "Upload & select"}</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
