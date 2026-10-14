"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ProfileForm from "./profile-form";
import { profileName, type Profile } from "@/lib/profile";
import styles from "../page.module.css";

/** Pixel profile card above the gallery. Clicking it opens the name/photo editor. */
export default function ProfileHeader({ profile, photoUrl, incomplete, postCount }: { profile: Profile; photoUrl: string | null; incomplete: boolean; postCount: number }) {
  const confirmation = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const deletingLock = useRef(false);
  async function deleteAccount() {
    if (deletingLock.current) return;
    deletingLock.current = true; setDeleting(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || "Couldn’t finish deletion. Please retry.");
      window.location.replace("/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t finish deletion. Please retry."); setDeleting(false); deletingLock.current = false; }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const name = profileName(profile);
  const initials = [profile.first_name, profile.last_name].filter(Boolean).map(part => part!.trim().charAt(0)).join("").toUpperCase() || "?";
  // A missing name blocks the rest of the app, so open the editor right away.
  useEffect(() => { if (incomplete) dialog.current?.showModal(); }, [incomplete]);
  return <>
    <div className={styles.profileCard}>
      <span className={styles.profileCardAvatar}>{photoUrl ? <Image src={photoUrl} alt="" width={96} height={96} unoptimized /> : initials}</span>
      <span className={styles.profileCardText}>
        <strong>{name}</strong>
        <small>{postCount} {postCount === 1 ? "post" : "posts"}</small>
      </span>
      <div className={styles.profileActions}>
        <button type="button" className={styles.profileCardEdit} onClick={() => dialog.current?.showModal()}>Edit profile</button>
      </div>
    </div>
    <dialog ref={confirmation} className={styles.profileDialog} aria-labelledby="delete-account-title" onClick={event => { if (event.target === event.currentTarget && !deletingLock.current) confirmation.current?.close(); }} onCancel={event => { if (deleting) event.preventDefault(); }}>
      <div className={styles.profileDialogInner}>
        <h2 id="delete-account-title">Delete your account permanently?</h2>
        <p>Your account, profile photo, posts, generated drafts, and votes will be permanently deleted. This cannot be undone.</p>
        <p>Your uploaded memory photos will stay in the shared image library for others to use. Other people’s memories using those photos will remain unchanged.</p>
        <div className={styles.profileActions}>
          <button type="button" className={styles.profileCardEdit} disabled={deleting} onClick={() => confirmation.current?.close()} autoFocus>Cancel</button>
          <button type="button" className={styles.deleteAccountButton} disabled={deleting} onClick={() => void deleteAccount()}>{deleting ? "Deleting…" : "Yes, delete permanently"}</button>
        </div>
        {deleting && <p role="status">Deleting your account. Please keep this page open.</p>}
        {error && <p role="alert" className={styles.formError}>{error}</p>}
      </div>
    </dialog>
    <dialog ref={dialog} className={styles.profileDialog} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.profileDialogInner}>
        <button type="button" className={styles.composeClose} aria-label="Close profile editor" onClick={() => dialog.current?.close()}>×</button>
        <h2>Edit profile</h2>
        <ProfileForm profile={profile} photoUrl={photoUrl} incomplete={incomplete} onSaved={() => dialog.current?.close()} onDeleteAccount={() => { setError(""); confirmation.current?.showModal(); }} />

      </div>
    </dialog>
  </>;
}
