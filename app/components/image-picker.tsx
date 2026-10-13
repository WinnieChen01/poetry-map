"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { preparePhoto } from "../../lib/prepare-photo";
import type { MemeImage } from "./post-composer";
import styles from "../page.module.css";

type ImagePickerMode = "browse" | "upload";

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
  const [preview, setPreview] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
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
  async function upload(next: File) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    onBusy(true);
    try {
      setStatus("Preparing photo…");
      const prepared = await preparePhoto(next);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(prepared); setPreview(previewUrl.current);
      setStatus("Uploading and generating a description…");
      const form = new FormData(); form.set("image", prepared);
      const response = await fetch("/api/images", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      onSelect(data.image); setImages(current => [data.image, ...current]);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = ""; setPreview(""); setPendingFile(null); onModeChange("browse");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t upload. Please retry."); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]; setError("");
    if (!next) return;
    if (lock.current) return;
    setPendingFile(next);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = ""; setPreview("");
    event.target.value = "";
    void upload(next);
  }
  return <section aria-label="Choose a photo">
    <div className={styles.imageOptions}>
      <button type="button" aria-pressed={mode === "upload"} disabled={busy} onClick={() => { onModeChange("upload"); setError(""); }}>Upload image</button>
      <button type="button" aria-pressed={mode === "browse"} disabled={busy} onClick={() => { onModeChange("browse"); setError(""); }}>Browse images</button>
    </div>
    {mode === "browse" ? <>
      <div className={styles.imageLibrary} aria-label="Image library" aria-busy={busy}>
        {images.map(image => <button key={image.id} type="button" disabled={busy} aria-label={`Choose ${image.description}`} aria-pressed={selected?.id === image.id} onClick={() => onSelect(image)}><Image src={image.image_url} alt={image.description} width={140} height={110} unoptimized /></button>)}
      </div>
      {!busy && page >= 0 && !images.length && <p>No images yet. Upload the first one.</p>}
      {(hasMore || page === -1 || error) && <button type="button" disabled={busy} onClick={() => void load(page + 1)}>{busy ? "Loading…" : error ? "Retry" : "Load more"}</button>}
    </> : <>
      <label>Choose image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={chooseFile} /></label>
      {pendingFile && <p className={styles.hint}>{pendingFile.name}</p>}
      {preview && <Image className={styles.uploadPreview} src={preview} alt="Upload preview" width={300} height={180} unoptimized />}
      <p className={styles.hint}>{busy ? status : "JPG, PNG or WebP · Up to 20 MB. Large photos are resized automatically."}</p>
    </>}
    {error && <p role="alert">{error}</p>}
    {mode === "upload" && error && preview && pendingFile && !busy && <button type="button" onClick={() => void upload(pendingFile)}>Retry upload</button>}
  </section>;
}
