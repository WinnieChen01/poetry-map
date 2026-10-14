"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "../page.module.css";

const subscribe = () => () => {};
const serverSnapshot = () => "day";

export default function MemoryCard({ createdAt, children }: { createdAt: string; children: ReactNode }) {
  // Resolve the saved timestamp in the viewer's timezone after hydration.
  const period = useSyncExternalStore(subscribe, () => {
    const hour = new Date(createdAt).getHours();
    if (hour < 6 || hour >= 20) return "night";
    if (hour < 10) return "morning";
    if (hour >= 17) return "dusk";
    return "day";
  }, serverSnapshot);

  const timestamp = useSyncExternalStore(subscribe, () => {
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
  }, () => "");

  return <article className={styles.card} data-period={period}>{children}{timestamp && <time className={styles.cardTimestamp} dateTime={createdAt}>Created {timestamp}</time>}</article>;
}
