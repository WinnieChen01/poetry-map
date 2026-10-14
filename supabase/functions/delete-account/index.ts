import { createClient } from "npm:@supabase/supabase-js@2.117.0";
Deno.serve(async (request: Request) => {
  const reply = (body: object, status = 200) => Response.json(body, { status });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return reply({ error: "Sign in required" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return reply({ error: "Sign in required" }, 401);
  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "DELETE") return reply({ error: "Confirmation required" }, 400);
  try {
    // Only the authenticated user's UUID prefix is accepted, never a supplied ID.
    for (const bucket of ["avatars"]) {
      while (true) {
        const { data, error } = await admin.storage.from(bucket).list(user.id, { limit: 100 });
        if (error) throw error;
        if (!data?.length) break;
        if (data.some(file => !file.id)) throw new Error("Unexpected nested folder");
        const { error: removeError } = await admin.storage.from(bucket).remove(data.map(file => `${user.id}/${file.name}`));
        if (removeError) throw removeError;
      }
    }
    const { error: releaseError } = await admin.rpc("release_account_photo_ownership", { target_user: user.id });
    if (releaseError) throw releaseError;
    // The database trigger removes posts and generations, preserving image records
    // with the Auth deletion; profile, votes and sessions cascade from auth.users.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return reply({ success: true });
  } catch {
    return reply({ error: "Deletion couldn’t finish. Your uploaded memory photos are kept; your profile photo may already be removed. Please retry to finish deleting your account." }, 503);
  }
});
