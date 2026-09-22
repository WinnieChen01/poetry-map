import styles from "./page.module.css";

export default function Loading() {
  return <main className={styles.page}><p className={styles.notice} role="status">Loading posts…</p></main>;
}
