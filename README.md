# Joke Generator

A pixel campus map with a trending meme newspaper, Google sign-in, editable profiles, AI caption generation, and voting.

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
- `/profile`: requires sign-in; edit names and crop/upload a photo.
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

## AI captions and voting

Use **+new** to upload an image or browse the thumbnail library, then describe a situation. Generation uses the image’s stored description and situation (text input), then shows a preview before publishing. The model output, exact prompt, situation, model name, image ID and optional map location are saved in `generations`. Failed attempts remain without a caption and count toward the 10-attempt hourly limit. Closing the composer keeps the preview during the current page session; reloading clears the preview but does not delete its database record.

Published posts reference their generation. The newspaper ranks by score, then newest first, showing up to 60 posts. Original manual posts that predate AI captions are votable too. One vote per user/post is enforced in the database; clicking the selected vote removes it, and selecting the other changes it. A trigger updates public scores atomically without exposing voter identities.

The remote migrations `ai_captions_votes_and_owner_rls` and `restrict_internal_trigger_execution` are applied to the existing Supabase project. RLS is enabled on all five public tables:

- `images`: public read; no client writes.
- `posts`: public read; authenticated users publish only their own completed generations. No client updates/deletes.
- `profiles`: only the owner can read or update their profile; signup trigger creates it.
- `generations`: owner-only read/create; only an unfinished caption can be completed. Prompts and ownership cannot be changed through the client API.
- `votes`: owner-only read/insert/update/delete for any post. Value is -1 or 1, with unique user/post pairs.

Generation and voting endpoints validate the session and request origin. All queries use the user's session and RLS, with no service-role key. The API key stays on the server. Storage policies continue to restrict avatar uploads/deletes to the user's folder. Public avatar URLs remain publicly viewable.

Create a Gemini API key in Google AI Studio and add it to `.env.local` and Vercel (never prefix it with `NEXT_PUBLIC_`). Restart local development after configuring it. Model availability and quotas depend on your Google project; `GEMINI_MODEL` can override the default (comma-separate multiple models to enable fallback when one is overloaded).

## Checks

```sh
npm run lint
npm run build
```

Before deploying, test Google login, missing-name completion, profile persistence after refresh, photo cropping/upload, and signed-out access to `/profile`.

## Deployment

Use the existing `WinnieChen01/joke-generator` repository and Vercel project. Set the Supabase and Gemini environment variables in Vercel, then push to the connected production branch. Environment-variable changes require a new deployment.

For submission, verify the deployment-specific URL in Incognito Mode with Vercel deployment protection off. Ensure its `/auth/callback` URL is allowed in Supabase before testing Google login on that deployment.

## Image library uploads

The composer offers Upload image and Browse images. The library is paginated in groups of 24. Uploads accept JPEG, PNG, and WebP up to 2 MB; the server validates/decode-checks them, strips metadata, and resizes to a maximum of 1600 pixels before storing WebP. Uploaded images are publicly reusable.

Upload setup requires `images.user_id`, `images.storage_path`, an owner-scoped metadata INSERT policy, and owner-folder INSERT/SELECT plus unused-file DELETE policies on the `meme-images` storage bucket. These additional upload policies have not yet been applied; reconnect Supabase or run the separately provided setup SQL. No service-role key is required.

## Map locations

The composer’s **Drop to a location** button temporarily closes the dialog. Select a building on the map (or in the accessible building list) to return with that location. Cancel preserves the previous choice. Image and situation state remain mounted throughout selection. Location is chosen before generation and locked for the generated preview, so the prompt context and published location stay consistent. Start over to choose another location after generating.

The existing `generations.location` and `posts.location` columns store the building name; no migration is needed. The generation endpoint validates names against `lib/campus-buildings.ts`. The stylized map’s hit regions are approximate visual associations, not geographically accurate campus footprints.
