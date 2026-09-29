import { NextResponse, type NextRequest } from "next/server";
import { hasCompleteName } from "@/lib/profile";
import { createAuthClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // The configured redirect URL is exactly /auth/callback.
  // Supabase itself appends the single-use authorization code for PKCE exchange.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.searchParams.has("error")) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("id,first_name,last_name,avatar_path").eq("id", user.id).maybeSingle()
        : { data: null };
      const destination = user ? (hasCompleteName(profile) ? "/" : "/profile") : "/login";
      const response = NextResponse.redirect(new URL(destination, request.url), 303);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    console.error("Google callback failed:", error.code ?? "authentication_error");
  }
  return new Response("Sign-in could not be completed. Return to /login and try again.", {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
