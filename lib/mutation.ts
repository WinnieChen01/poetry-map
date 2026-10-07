import { createAuthClient } from "@/lib/supabase/server";

export const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function mutation(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return { error: reply({ error: "Invalid request origin." }, 403) };
  const db = await createAuthClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return { error: reply({ error: "Please sign in to continue." }, 401) };
  // Bound the actual streamed body, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return { error: reply({ error: "Missing request." }, 400) };
  let text = "", size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 10000) { await reader.cancel(); return { error: reply({ error: "Request too large." }, 413) }; }
      text += decoder.decode(value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return { db, user, body };
  } catch { return { error: reply({ error: "Invalid request." }, 400) }; }
}
