import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import GoogleButton from "./google-button";
import styles from "../page.module.css";

export const metadata = { title: "Sign in | Memory Diary" };

export default async function LoginPage() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/profile");

  return (
    <main className={styles.page}>
      <header className={styles.userHeader}><Link href="/">Back to posts</Link></header>
      <section className={styles.authPanel}>
        <h1>Sign in</h1>
        <GoogleButton />
      </section>
    </main>
  );
}
