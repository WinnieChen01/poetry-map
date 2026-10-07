"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";
export default function VoteButtons({ postId, signedIn, initialValue, initialScore }: { postId: string; signedIn: boolean; initialValue: number; initialScore: number }) {
  const [value, setValue] = useState(initialValue);
  const [score, setScore] = useState(initialScore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function vote(choice: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, value: value === choice ? 0 : choice }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn’t save vote.");
      setValue(data.value); setScore(typeof data.score === "number" ? data.score : score + data.value - value);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn’t connect."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className={styles.voteArea}>
    <div className={styles.voteButtons}>
      {signedIn ? <><button aria-label="Upvote caption" aria-pressed={value === 1} disabled={busy} onClick={() => void vote(1)}>▲</button><span aria-live="polite">{score}</span><button aria-label="Downvote caption" aria-pressed={value === -1} disabled={busy} onClick={() => void vote(-1)}>▼</button></> : <><span>{score} points</span><Link href="/login">Sign in to vote</Link></>}
    </div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
