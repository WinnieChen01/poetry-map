import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { avatarUrl, hasCompleteName } from "@/lib/profile";
import AccountHeader from "../components/account-header";
import ProfileForm from "./profile-form";
import styles from "../page.module.css";

export const metadata = { title: "Your profile | Joke Generator" };

export default async function ProfilePage() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles")
    .select("id,first_name,last_name,avatar_path").eq("id", user.id).maybeSingle();
  const incomplete = !hasCompleteName(profile);

  return (
    <main className={styles.page}>
      <AccountHeader />
      <section className={styles.profilePanel}>
        <h1>Profile</h1>
        {error || !profile ? (
          <p className={styles.formError} role="alert">Your profile couldn’t be loaded. Please try again after profile access has been configured.</p>
        ) : <ProfileForm profile={profile} photoUrl={avatarUrl(profile.avatar_path)} incomplete={incomplete} />}
      </section>
    </main>
  );
}
