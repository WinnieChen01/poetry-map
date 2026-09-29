export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
};

export function hasCompleteName(profile: Profile | null): boolean {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

export function profileName(profile: Profile | null): string {
  return [profile?.first_name?.trim(), profile?.last_name?.trim()].filter(Boolean).join(" ") || "Your profile";
}

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/avatars/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}
