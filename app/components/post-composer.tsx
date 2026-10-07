"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ImagePicker from "./image-picker";
import styles from "../page.module.css";
export type MemeImage = { id: string; image_url: string; description: string };
export default function PostComposer({ images, location, onPublished, onPickLocation, onClearLocation }: { images: MemeImage[]; location: string; onPublished: () => void; onPickLocation: () => void; onClearLocation: () => void }) {
  const router = useRouter();
  const [image, setImage] = useState<MemeImage | undefined>(images[0]);
  const [situation, setSituation] = useState("");
  const [draft, setDraft] = useState<{ id: string; caption: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);

  async function submit(publish: boolean) {
    if (locked.current || uploading) return;
    locked.current = true; setBusy(publish ? "Publishing…" : "Generating…"); setError("");
    try {
      const response = await fetch(publish ? "/api/publish" : "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publish ? { generationId: draft?.id } : { imageId: image?.id, situation, location }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      if (publish) { setDraft(null); setSituation(""); router.refresh(); onPublished(); }
      else {
        if (typeof data.id !== "string" || typeof data.caption !== "string" || !data.caption.trim()) {
          throw new Error("No caption was returned. Your draft is unchanged; please try again.");
        }
        setDraft({ id: data.id, caption: data.caption.trim() });
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t connect. Please retry."); }
    finally { locked.current = false; setBusy(""); }
  }
  return <form onSubmit={event => { event.preventDefault(); void submit(!!draft); }}>
    <div className={styles.composerLocation}>
      {location && <span>{location}</span>}
      <button type="button" disabled={!!busy || uploading || !!draft} onClick={onPickLocation}>{location ? "Change location" : "Drop to a location"}</button>
      {location && !draft && <button type="button" disabled={!!busy || uploading} onClick={onClearLocation}>Remove</button>}
    </div>
    <fieldset disabled={!!busy || !!draft} className={styles.composerFields}>
      {!draft && <ImagePicker selected={image} onSelect={setImage} onBusy={setUploading} />}
      <label>Situation<textarea value={situation} onChange={event => setSituation(event.target.value)} required maxLength={500} rows={3} placeholder="When you finally find a seat at Butler…" /></label>
    </fieldset>
    {draft && <div className={styles.captionResult} role="status">{draft.caption}</div>}
    {error && <div className={styles.captionError} role="alert">{error}</div>}
    {busy && <div className={styles.generationLoading}>
      <p role="status">{busy === "Generating…" ? "Creating your caption… This can take a few minutes. The bar estimates waiting time." : "Publishing your post…"}</p>
      <div className={styles.generationTrack} role="progressbar" aria-valuetext="Waiting for a response; animation is estimated, not measured progress" aria-label={busy === "Generating…" ? "Generating caption" : "Publishing post"}>
        <span className={styles.generationRunner} />
      </div>
    </div>}
    {image && <div className={styles.captionPreview}><Image src={image.image_url} alt={image.description} width={300} height={230} unoptimized /></div>}
    <div className={styles.composerActions}>
      <button className={styles.authButton} disabled={!!busy || uploading || !image} type="submit">{busy || (draft ? "Post" : "Generate caption")}</button>
      {draft && <button type="button" disabled={!!busy} onClick={() => setDraft(null)}>Start over</button>}
    </div>


  </form>;
}
