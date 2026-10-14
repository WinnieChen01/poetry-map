import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { avatarUrl, hasCompleteName } from "@/lib/profile";
import AccountHeader from "../components/account-header";
import ProfileHeader from "./profile-header";
import MyPosts, { type MyPost } from "./my-posts";
import styles from "../page.module.css";

export const metadata = { title: "Your posts | Poetry Map" };

export default async function ProfilePage() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles")
    .select("id,first_name,last_name,avatar_path").eq("id", user.id).maybeSingle();
  const incomplete = !hasCompleteName(profile);
  const { data: posts } = await supabase.from("posts").select("id,caption,location,score,images(image_url,description)").eq("user_id", user.id).order("created_at", { ascending: false }).order("id").returns<MyPost[]>();

  return (
    <main className={`${styles.page} ${styles.profilePage}`}>
      <AccountHeader />
      <section className={styles.profileGallery}>
        {error || !profile ? (
          <p className={styles.formError} role="alert">Your profile couldn’t be loaded. Please try again after profile access has been configured.</p>
        ) : (
          <ProfileHeader profile={profile} photoUrl={avatarUrl(profile.avatar_path)} incomplete={incomplete} postCount={(posts ?? []).length} />
        )}
        <div className={styles.profileSectionHeading}>
          <h1>your posts</h1>
          <span>{(posts ?? []).length} {(posts ?? []).length === 1 ? "post" : "posts"}</span>
        </div>
        <MyPosts posts={posts ?? []} />
      </section>
    </main>
  );
}
