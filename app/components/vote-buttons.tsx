"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";
export default function VoteButtons({ postId, signedIn, initialValue, initialScore }: { postId: string; signedIn: boolean; initialValue: number; initialScore: number }) {
  const [value, setValue] = useState(initialValue);
  const [score, setScore] = useState(initialScore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const loginDialog = useRef<HTMLDialogElement>(null);
  const dialogTitle = useId();
  async function vote(choice: number) {
    if (!signedIn) { loginDialog.current?.showModal(); return; }
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, value: value === choice ? 0 : choice }) });
      const data = await response.json();
      if (response.status === 401) { loginDialog.current?.showModal(); return; }
      if (!response.ok) throw new Error(data.error || "Couldn’t save vote.");
      setValue(data.value); setScore(typeof data.score === "number" ? data.score : score + data.value - value);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t connect."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className={styles.voteArea}>
    <div className={styles.voteButtons}>
      <button type="button" aria-label="Upvote post" aria-pressed={signedIn && value === 1} disabled={busy} onClick={() => void vote(1)}>▲</button>
      <span aria-live="polite">{score}</span>
      <button type="button" aria-label="Downvote post" aria-pressed={signedIn && value === -1} disabled={busy} onClick={() => void vote(-1)}>▼</button>
    </div>
    <dialog ref={loginDialog} className={styles.voteLoginDialog} aria-labelledby={dialogTitle} onClick={event => { if (event.target === event.currentTarget) loginDialog.current?.close(); }}>
      <h2 id={dialogTitle}>Login required</h2>
      <p>Please login to vote.</p>
      <div className={styles.composerActions}>
        <button type="button" className={styles.profileCardEdit} autoFocus onClick={() => loginDialog.current?.close()}>Cancel</button>
        <Link className={styles.authButton} href="/login">Login</Link>
      </div>
    </dialog>
    {error && <p role="alert">{error}</p>}
  </div>;
}
