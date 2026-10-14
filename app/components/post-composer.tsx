"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { MemoryPin } from "@/lib/memory-pin";
import ImagePicker from "./image-picker";
import { normalizePoem, refinementOptions, type Refinement } from "@/lib/poetry";
import styles from "../page.module.css";
export type MemeImage = { id: string; image_url: string; description: string };
export default function PostComposer({ images, pin, onPublished, onPickLocation }: { images: MemeImage[]; pin: MemoryPin | null; onPublished: () => void; onPickLocation: () => void; }) {
  const router = useRouter();
  const selectedPin: MemoryPin = pin ?? { mapId: "columbia", x: 548, y: 587, location: "Lawn" };
  const [image, setImage] = useState<MemeImage | undefined>(images[0]);
  const [mode, setMode] = useState<"browse" | "upload">("browse");
  const [situation, setSituation] = useState("");
  const [tone, setTone] = useState<Refinement | "">("");
  const [draft, setDraft] = useState<{ id: string; caption: string } | null>(null);
  const [poem, setPoem] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);

  async function generate(refinement: Refinement | "" = "") {
    if (locked.current || uploading || !image) return;
    if (draft && !normalizePoem(poem)) { setError("Use three nonempty lines, up to 300 characters, before refining."); return; }
    locked.current = true; setBusy("Generating poem…"); setError("");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId: image.id, situation, refinement, previousPoem: draft ? poem : "" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      const generated = normalizePoem(data.caption);
      if (typeof data.id !== "string" || !generated) throw new Error("No three-line poem was returned. Your draft is unchanged; please retry.");
      setDraft({ id: data.id, caption: generated }); setPoem(generated);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t connect. Please retry."); }
    finally { locked.current = false; setBusy(""); }
  }
  async function save() {
    if (locked.current || !draft) return;
    const edited = normalizePoem(poem);
    if (!edited) { setError("Use three nonempty lines, up to 300 characters total."); return; }
    locked.current = true; setBusy("Saving poem…"); setError("");
    try {
      let generationId = draft.id;
      if (edited !== draft.caption) {
        const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", generationId, poem: edited }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Couldn’t save your edits.");
        generationId = data.id;
        // Retain the saved revision so a publish retry doesn't create it twice.
        setDraft({ id: generationId, caption: edited });
      }
      const response = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generationId, pin: selectedPin }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t save your poem.");
      setDraft(null); setPoem(""); setSituation(""); router.refresh(); onPublished();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t connect. Your edits are still here."); }
    finally { locked.current = false; setBusy(""); }
  }
  function resetDraft() { setDraft(null); setPoem(""); setError(""); }
  // "More nostalgic" reads as a comparison only once a poem exists; before the
  // first poem the same tones are offered as plain labels.
  const toneLabel = (option: string) => { const word = option.replace(/^More\s+/i, ""); return word.charAt(0).toUpperCase() + word.slice(1); };
  return <form onSubmit={event => { event.preventDefault(); void (draft ? save() : generate(tone)); }}>
    <fieldset disabled={!!busy || !!draft} className={styles.composerFields}>
      {!draft && <ImagePicker selected={image} onSelect={setImage} onBusy={setUploading} mode={mode} onModeChange={setMode} />}
      <label>What stands out to you in this moment? (optional)<textarea value={situation} onChange={event => setSituation(event.target.value)} maxLength={500} rows={3} placeholder="The late sunlight turned the windows gold. I stopped for a moment on my way home." /></label>
      {!draft && <div className={styles.tonePicker} role="group" aria-label="Poem tone (optional)">
        <span>Tone (optional)</span>
        <button type="button" aria-pressed={tone === ""} onClick={() => setTone("")}>Default</button>
        {refinementOptions.map(option => <button key={option} type="button" aria-pressed={tone === option} onClick={() => setTone(option)}>{toneLabel(option)}</button>)}
      </div>}
    </fieldset>
    {draft && <div className={styles.poemEditor}>
      <label>Your poem<textarea value={poem} onChange={event => setPoem(event.target.value)} rows={4} maxLength={300} disabled={!!busy} aria-describedby="poem-edit-hint" /></label>
      <p id="poem-edit-hint">Make it your own. Three lines, up to 300 characters.</p>
      <div className={styles.poemRefinements} aria-label="Refine your poem">
        {refinementOptions.map(option => <button key={option} type="button" disabled={!!busy} onClick={() => void generate(option)}>{option}</button>)}
      </div>
    </div>}
    {error && <div className={styles.captionError} role="alert">{error}</div>}
    {busy && <div className={styles.generationLoading}>
      <p role="status">{busy} {busy === "Generating poem…" && "This can take a few minutes. The bar estimates waiting time."}</p>
      <div className={styles.generationTrack} role="progressbar" aria-valuetext="Waiting for a response; animation is estimated, not measured progress" aria-label={busy}>
        <span className={styles.generationRunner} />
      </div>
    </div>}
    {image && mode === "browse" && <div className={styles.captionPreview}><Image src={image.image_url} alt={image.description} width={300} height={230} unoptimized /></div>}
    {draft && <div className={styles.composerLocation}>
      <span>{selectedPin.location || "Columbia campus"}</span>
      <button type="button" disabled={!!busy} onClick={onPickLocation}>Choose location</button>
    </div>}
    <div className={styles.composerActions}>
      <button className={styles.authButton} disabled={!!busy || uploading || !image || mode === "upload"} type="submit">{busy || (draft ? "Save memory" : "Generate poem")}</button>
      {draft && <><button type="button" disabled={!!busy} onClick={() => void generate()}>Regenerate</button><button type="button" disabled={!!busy} onClick={resetDraft}>Change image or context</button></>}
    </div>
    {draft && <p className={styles.hint}>Saving shares this poem on the map and in the feed.</p>}
  </form>;
}
