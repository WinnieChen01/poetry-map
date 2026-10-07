"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import ProfileForm from "./profile-form";
import { profileName, type Profile } from "@/lib/profile";
import styles from "../page.module.css";

/** Pixel profile card above the gallery. Clicking it opens the name/photo editor. */
export default function ProfileHeader({ profile, photoUrl, incomplete, postCount }: { profile: Profile; photoUrl: string | null; incomplete: boolean; postCount: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const name = profileName(profile);
  const initials = [profile.first_name, profile.last_name].filter(Boolean).map(part => part!.trim().charAt(0)).join("").toUpperCase() || "?";
  // A missing name blocks the rest of the app, so open the editor right away.
  useEffect(() => { if (incomplete) dialog.current?.showModal(); }, [incomplete]);
  return <>
    <button type="button" className={styles.profileCard} onClick={() => dialog.current?.showModal()} aria-label={`Edit profile and photo for ${name}`}>
      <span className={styles.profileCardAvatar}>{photoUrl ? <Image src={photoUrl} alt="" width={96} height={96} unoptimized /> : initials}</span>
      <span className={styles.profileCardText}>
        <strong>{name}</strong>
        <small>{postCount} {postCount === 1 ? "post" : "posts"} · click to edit name & photo</small>
      </span>
      <span className={styles.profileCardEdit}>Edit profile</span>
    </button>
    <dialog ref={dialog} className={styles.profileDialog} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.profileDialogInner}>
        <button type="button" className={styles.composeClose} aria-label="Close profile editor" onClick={() => dialog.current?.close()}>×</button>
        <h2>Edit profile</h2>
        <ProfileForm profile={profile} photoUrl={photoUrl} incomplete={incomplete} onSaved={() => dialog.current?.close()} />
      </div>
    </dialog>
  </>;
}
