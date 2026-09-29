# Joke Generator

A Next.js app with a Supabase meme feed, Google sign-in, and editable profiles with avatar cropping.

## Local development

```sh
npm ci
npm run dev
```

Create `.env.local` with these variables, using your Supabase project's values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

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

For the Week 3 assignment, `profiles` RLS is disabled. This means table permissions do not restrict users to their own rows; the protected app route alone does not provide database row isolation.

## Checks

```sh
npm run lint
npm run build
```

Before deploying, test Google login, missing-name completion, profile persistence after refresh, photo cropping/upload, and signed-out access to `/profile`.

## Deployment

Use the existing `WinnieChen01/joke-generator` repository and Vercel project. Set the same Supabase environment variables in Vercel, then push to the connected production branch. Environment-variable changes require a new deployment.

For submission, verify the deployment-specific URL in Incognito Mode with Vercel deployment protection off. Ensure its `/auth/callback` URL is allowed in Supabase before testing Google login on that deployment.
