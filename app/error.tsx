"use client";

import styles from "./page.module.css";

export default function PostsError() {
  return (
    <main className={styles.page}>
      <section className={styles.notice} role="alert">
        <h1>Posts couldn’t load</h1>
        <p>Please try again in a moment.</p>
        <button className={styles.retry} onClick={() => window.location.reload()}>Try again</button>
      </section>
    </main>
  );
}
