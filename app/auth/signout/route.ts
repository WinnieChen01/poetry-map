import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new Response("Invalid request origin.", { status: 403 });
  }
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return new Response("Sign out failed. Please try again.", { status: 503 });
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
