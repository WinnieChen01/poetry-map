# Memory Diary

A location-based memory diary with photos, three-line AI-assisted poems, Google sign-in, editable profiles, and voting.

## Local development

```sh
npm ci
npm run dev
```

Create `.env.local` with these variables, using your Supabase project's values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
GEMINI_API_KEY=YOUR_SERVER_ONLY_GEMINI_KEY
GEMINI_MODEL=gemini-3.8-flash
```

`GEMINI_MODEL` accepts a comma-separated fallback list (for example `gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite`). Gemini returns `503` when a single model is overloaded and `429` when that model's quota is exhausted, so the app tries each model in order and uses the first healthy one.

Environment files are ignored by Git. Open http://localhost:3000.

## App routes

- `/`: public meme cards; signed-in users with missing names are directed to their profile.
- `/login`: Google sign-in.
- `/auth/callback`: exchanges the OAuth code for a session.
- `/profile`: requires sign-in; shows a pixel profile card (click to change name/photo) above a gallery of the user’s posts, where each post can be edited (caption/location) or deleted.
- `/posts`: redirects to the homepage for existing links.

The Google client ID and secret are configured in Supabase's Google provider, not in this app.
Allow the app's exact `/auth/callback` URL in Supabase's redirect settings for each environment being tested. Google Cloud uses the Supabase Auth callback URL shown in that provider's settings.

## Supabase setup

The app expects:

- `images` and `posts`, joined by `posts.image_id`.
- `profiles` with `id` linked to `auth.users.id`, nullable `first_name` and `last_name`, and `avatar_path`.
- An `auth.users` insert trigger that creates a profile row.
- Public `meme-images` and `avatars` Storage buckets.
- Authenticated profile read/update permissions and avatar Storage policies scoped to each user's ID folder.

Avatars are saved as cropped JPEG files in Storage. Only their paths are stored in `profiles`. The original upload is retained in browser memory during editing, not persisted.

## Poetry generation and editing

Use **+new** to upload a photo or browse the existing library. Optionally describe your mood, thoughts, activity, or what the moment means to you (up to 500 characters). **Generate poem** sends the actual photo plus this context to the existing Gemini integration. Server-side image loading is restricted to this project's `meme-images` bucket, bounded to 8 MB, and resized before being passed as inline image data. Uploaded originals remain in Storage.

The prompt requests exactly three nonempty lines, no title or explanation, and natural, specific imagery without clichés or invented personal experiences. No 5-7-5 syllable count is enforced. Without context, the prompt focuses on visible atmosphere without assuming the user's emotions. Generated poems fit the existing 300-character storage limit.

**Regenerate** creates a fresh variation. **More nostalgic**, **More playful**, **More peaceful**, and **More poetic** send the chosen tone and the current edited poem alongside the original photo/context. The tone is stylistic, not a claim about the user's actual experiences. If generation fails, the current poem and edits remain intact.

The generated poem is editable before **Save poem**, which shares it publicly in the existing feed and selected location. An edited version is recorded as a separate generation row marked `model=manual-edit`, with its source generation ID, original text, and edited text in the revision's prompt metadata. The original model output and prompt stay unchanged. Publishing then uses the existing ownership checks and generation link; retries reuse the saved revision. Both AI calls and manual draft revisions count toward the existing 10-row hourly limit.

The poetry text reuses existing columns: `caption` stores the poem, `situation` stores optional context, and `prompt` stores the full generation/refinement instructions. Existing posts, location behavior, authentication, storage, and voting remain compatible. The internal `MemeImage` type and `meme-images` bucket keep their names to avoid unrelated migrations.

Published posts reference their generation. The newspaper shows up to 60 posts with **trending** (highest score) and **new** (newest first) tabs. Original manual posts that predate AI captions are votable too. One vote per user/post is enforced in the database; clicking the selected vote removes it, and selecting the other changes it. A trigger updates public scores atomically without exposing voter identities.

The remote migrations `ai_captions_votes_and_owner_rls` and `restrict_internal_trigger_execution` are applied to the existing Supabase project. RLS is enabled on all five public tables:

- `images`: public read; authenticated users upload their own images (`user_id` / `storage_path`, column-limited insert).
- `posts`: public read; authenticated users publish their own completed generations and can update the caption/location or delete posts they own (`user_id`, backfilled from the generation).
- `profiles`: only the owner can read or update their profile; signup trigger creates it.
- `generations`: owner-only read/create; only an unfinished caption can be completed. Prompts and ownership cannot be changed through the client API.
- `votes`: owner-only read/insert/update/delete for any post. Value is -1 or 1, with unique user/post pairs.

Generation and voting endpoints validate the session and request origin. All queries use the user's session and RLS, with no service-role key. The API key stays on the server. Storage policies continue to restrict avatar uploads/deletes to the user's folder. Public avatar URLs remain publicly viewable.

Create a Gemini API key in Google AI Studio and add it to `.env.local` and Vercel (never prefix it with `NEXT_PUBLIC_`). Restart local development after configuring it. Model availability and quotas depend on your Google project; `GEMINI_MODEL` can override the default (comma-separate multiple models to enable fallback when one is overloaded).

## Checks

```sh
npm run lint
node --experimental-strip-types --test tests/poetry.test.mjs
npm run build
```

Before deploying, test Google login, missing-name completion, profile persistence after refresh, photo cropping/upload, and signed-out access to `/profile`.

## Deployment

Use the existing `WinnieChen01/joke-generator` repository and Vercel project. Set the Supabase and Gemini environment variables in Vercel, then push to the connected production branch. Environment-variable changes require a new deployment.

For submission, verify the deployment-specific URL in Incognito Mode with Vercel deployment protection off. Ensure its `/auth/callback` URL is allowed in Supabase before testing Google login on that deployment.

## Image library uploads

The composer offers Upload image and Browse images. The library is paginated in groups of 24. Uploads accept JPEG, PNG, and WebP up to 2 MB; the server validates/decode-checks them, strips metadata, and resizes to a maximum of 1600 pixels before storing WebP. Uploaded images are publicly reusable.

Upload setup requires `images.user_id`, `images.storage_path`, an owner-scoped metadata INSERT policy, and owner-folder INSERT/SELECT plus unused-file DELETE policies on the `meme-images` storage bucket. These additional upload policies have not yet been applied; reconnect Supabase or run the separately provided setup SQL. No service-role key is required.

## Maps

The app uses low-resolution pixel maps (see `lib/maps.ts`):

- **Columbia campus** (`columbia`) — the detailed map that opens by default and where memory pins are dropped.
- **Manhattan island overview** (`manhattan`) — the Manhattan contour, kept transparent over the ocean, subdivided into ~30 named neighborhood regions (Inwood → Battery) with light boundary lines. Every district is dark; only ones that already have a detailed map are lit up. Today that is **Columbia** alone, so every other neighborhood is labelled but not yet selectable.

The site opens on the Columbia map (`DEFAULT_MAP_ID`). The **island** button in the map controls switches to the overview, which opens centred and scaled up (zoom out to 1 to see the whole island); **← columbia** or clicking the green Columbia area returns to the detailed map. Every map supports drag-pan, wheel/pinch zoom, and a Reset control, and all artwork is nearest-neighbor scaled (`image-rendering: pixelated`) so pixels stay crisp at every zoom level.

Making another district ready later means giving it a detailed local map, adding its name to the `DETAILED` set (or a `goto`) in the `bands` list in `scripts/build-maps.mjs`, regenerating, and allowing its `goto` target in `regionActionable`/`activateRegion` in `app/components/campus-map.tsx`.

Pins are dropped on the Columbia map (image → context → poem → refine/edit → pin → save). Pins use Columbia artwork coordinates (1102 × 1427), so zooming does not change their position.

### Regenerating the maps

The overworld and neighborhood PNGs, plus their hit regions (`lib/generated-maps.ts`), are produced deterministically by a tile-based pixel-art generator sharing one palette sampled from the Columbia map:

```sh
node scripts/build-maps.mjs
```

Edit the palette, tile sprites, or the per-neighborhood `LOCAL_MAPS` config in `scripts/build-maps.mjs`, then re-run it. The existing Columbia artwork (`public/maps/morningside-pixel-v2.png`) and `lib/campus-buildings.ts` are reused untouched and are never overwritten by the generator.

### Memory pinning

New memories follow image → context → poem → refine/edit → campus pin → save.
Map metadata is never passed to Gemini. The prompt excludes named places even
when mentioned in context. Pins use Columbia artwork coordinates (1102 × 1427),
so zooming does not change their position. The registry remains available for
future maps; the memory creation map currently stays on Columbia.

Database migrations `memory_pins_and_atomic_publish` and
`grant_memory_pin_insert_columns` are applied in Supabase. It adds `posts.map_id`, `pin_x`, and `pin_y`, with
bounds checks, and the authenticated `publish_memory` function. This operation
verifies draft ownership, saves text and coordinates atomically, and safely
returns the existing post on repeat requests. Existing rows and voting policies
are preserved. Verified authenticated saving, duplicate retry handling, foreign-draft rejection,
and anonymous access denial with rollback-only tests.

### Permanent account deletion

The profile header confirms deletion before calling `DELETE /api/account`.
The authenticated Supabase `delete-account` Edge Function deletes the caller's
profile photos from `avatars`, releases ownership of their `meme-images` objects
through a service-role-only RPC, then hard-deletes the Auth user. A private trigger
removes owned posts and generations; profile, votes and sessions cascade.
Memory image records and files remain in the shared library with no owner.
Other users' memories retain their photos. Storage and Auth changes are not atomic;
a failed attempt may remove the avatar or release image ownership before retry.
No service-role credential is sent to the browser or stored in Next.js.
Edge Function source is under `supabase/functions` (Deno runtime, excluded from
Next.js TypeScript compilation). Database cleanup was verified with rollback-only
tests and the deployed function rejects unauthenticated requests.
