import Link from "next/link";
import Image from "next/image";
import { createAuthClient } from "@/lib/supabase/server";
import { avatarUrl, profileName, type Profile } from "@/lib/profile";
import styles from "../page.module.css";

export default async function AccountHeader({ home = false }: { home?: boolean }) {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("id,first_name,last_name,avatar_path").eq("id", user.id).maybeSingle();
    profile = data;
  }
  const name = profileName(profile);
  const photo = avatarUrl(profile?.avatar_path);
  const initials = [profile?.first_name, profile?.last_name].filter(Boolean).map(n => n!.trim().charAt(0)).join("").toUpperCase() || "?";

  return (
    <header className={styles.userHeader}>
      {!home && <Link href="/" className={styles.backLink}>← Back to posts</Link>}
      <nav className={styles.accountNav} aria-label="Account">
        {user ? <>
          <Link href="/profile" className={styles.profileLink} aria-label={`Edit profile: ${name}`}>
            <span className={styles.avatar}>
              {photo ? <Image src={photo} alt="" width={36} height={36} unoptimized /> : initials}
            </span>
            <span className={styles.accountName}>{name}</span>
          </Link>
          <form action="/auth/signout" method="post"><button className={styles.signOut}>Sign out</button></form>
        </> : <Link href="/login" className={styles.authButton}>Sign in</Link>}
      </nav>
    </header>
  );
}
