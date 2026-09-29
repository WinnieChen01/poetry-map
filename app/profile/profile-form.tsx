"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/profile";
import styles from "../page.module.css";
import PhotoCropper from "./photo-cropper";

export default function ProfileForm({ profile, photoUrl, incomplete }: { profile: Profile; photoUrl: string | null; incomplete: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [cropOriginal, setCropOriginal] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  useEffect(() => {
    if (!cropSource) return;
    return () => URL.revokeObjectURL(cropSource);
  }, [cropSource]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cropSource) return;
    setPending(true); setError(""); setSaved(false);
    try {
      const body = new FormData(event.currentTarget);
      body.delete("photo");
      if (photo) body.set("photo", photo);
      const response = await fetch("/api/profile", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t save your profile.");
      setSaved(true);
      if (input.current) input.current.value = "";
      setPhoto(null); setPreview(null);
      if (incomplete) router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save your profile. Please try again.");
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={save} className={styles.profileForm}>
      <fieldset disabled={pending}>
        <div className={styles.photoRow}>
          <button type="button" className={`${styles.largeAvatar} ${styles.avatarButton}`} aria-label={preview || photoUrl ? "Adjust profile photo" : "Choose profile photo"} onClick={() => {
            setError("");
            if (original) {
              setCropOriginal(original);
              setCropSource(URL.createObjectURL(original));
            } else if (photoUrl) {
              setCropOriginal(null);
              setCropSource(photoUrl);
            } else input.current?.click();
          }}>
            {preview || photoUrl ? <Image src={preview || photoUrl!} alt="Your profile photo" width={88} height={88} unoptimized /> : <span aria-hidden="true">{profile.first_name?.charAt(0).toUpperCase() || "?"}</span>}
          </button>
          <div>
            <label htmlFor="photo" className={styles.photoLabel}>Profile photo <span>(optional)</span></label>
            <input ref={input} id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-hint" onChange={(e) => {
              const file = e.target.files?.[0];
              setSaved(false); setError("");
              if (!file) return;
              if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                setError("Choose a JPG, PNG or WebP image under 2 MB."); e.target.value = ""; return;
              }
              setCropOriginal(file);
              setCropSource(URL.createObjectURL(file));
              e.target.value = "";
            }} />
            <p id="photo-hint" className={styles.hint}>JPG, PNG or WebP · Up to 2 MB. Photos are publicly viewable by link.</p>
          </div>
        </div>
        {cropSource && <PhotoCropper key={cropSource} source={cropSource} onCancel={() => setCropSource(null)} onApply={file => {
          setPhoto(file);
          setOriginal(cropOriginal);
          setSaved(false);
          setPreview(URL.createObjectURL(file));
          setCropSource(null);
        }} />}
        <div className={styles.nameFields}>
          <label htmlFor="first_name">First name<input id="first_name" name="first_name" autoComplete="given-name" required maxLength={80} defaultValue={profile.first_name || ""} /></label>
          <label htmlFor="last_name">Last name<input id="last_name" name="last_name" autoComplete="family-name" required maxLength={80} defaultValue={profile.last_name || ""} /></label>
        </div>
        <div className={styles.formFooter}>
          <button className={styles.authButton} type="submit" disabled={!!cropSource}>{pending ? "Saving…" : incomplete ? "Save & continue" : "Save changes"}</button>
          {saved && <p role="status" className={styles.success}>Profile saved.</p>}
        </div>
      </fieldset>
      {error && <p role="alert" className={styles.formError}>{error}</p>}
    </form>
  );
}
