# i-Planner Admin

The admin dashboard for i-Planner: a React web app (Vite + TypeScript) meant to be hosted on Vercel.
It talks to the same backend as the mobile app, through the `/api/admin/*` endpoints, signed in with
a Firebase account that has the `admin` role.

Sections (each its own page, reached from the side menu):

| Page | What it does |
|---|---|
| Analytics (home) | People active now, users, new sign-ups, subscribed vs free, platforms |
| Announcements | Write and send a push notification, an email, or both; history |
| Users | Search every account (name, email, ID), see plans, suspend / restore |
| Leaderboard | The full points table, this week or all time |

## Run it locally

```bash
cd admin-web
cp .env.example .env.local     # fill in the values (see below)
npm install
npm run dev                    # http://localhost:5173
npm test                       # unit + page tests
npm run build                  # type-check + production build into dist/
```

## Environment variables

All public web config (they are compiled into the page). Use the same Firebase project as the app.

| Name | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | Firebase console → Project settings → Your apps → Web app. (The values the mobile app already uses as `EXPO_PUBLIC_FIREBASE_*`.) |
| `VITE_API_URL` | The backend including `/api`, e.g. `https://api.i-plannerapp.com/api` |

## Deploy to Vercel

1. Push the repository, then in Vercel choose **Add New → Project** and import it.
2. Set **Root Directory** to `admin-web`. Vercel detects Vite; `vercel.json` already sets the build
   command, output folder and the single-page-app rewrite.
3. Add the five environment variables above (Settings → Environment Variables), then deploy.
4. **Authorize the domain in Firebase:** console → Authentication → Settings → **Authorized domains**
   → add your Vercel domain (for example `i-planner-admin.vercel.app` and any custom domain). Without
   this, sign-in fails with `auth/unauthorized-domain`.
5. **Allow the dashboard to call the backend (CORS):** on Railway, set `CORS_ORIGIN` to the dashboard's
   address (for example `https://i-planner-admin.vercel.app`). Leaving it at `*` also works but allows
   any website to make requests with a visitor's token.

## Giving someone admin access

From the `backend` folder, on a machine with `backend/.env`:

```bash
npm run grant-admin -- someone@example.com                         # grant; creates the account if it doesn't exist
npm run grant-admin -- someone@example.com --password "My-Pass-123" # choose the password for a NEW account
npm run grant-admin -- --revoke someone@example.com                # remove the role
```

- If the account does not exist yet it is created, with the password you give (at least 8
  characters) or, if you give none, a strong random one that is printed **once**. Sign in, then change it.
- An account that already exists keeps its password; only the role is added.
- The role is a Firebase custom claim. Sign out and in again on the dashboard to pick it up. The
  role is checked by the **server** on every request, so hiding a page here is never the only protection.

## How it is organised

```
src/
  lib/          firebase.ts (init), api.ts (token + errors), adminApi.ts (every endpoint), types, format
  auth/         AuthProvider (sign-in state + admin role), RequireAdmin (route guard)
  hooks/        useAsyncResource, usePagedList, useDebouncedValue, useAccountModeration, useAnnouncementComposer
  components/
    ui/         Display, Controls, Feedback, Icon: the small reusable pieces
    layout/     AppShell (side menu), Page (title + body)
    analytics/  users/  leaderboard/  announcements/   one folder of components per section
  pages/        one thin page per section, composed from the above
  tests/        auth guard, API client, every page
```

## Notes

- **Downloads per platform** are not shown: the App Store and Google Play only provide download
  counts in their own consoles. "Platforms" shows accounts by the device they use the app on.
- "Active now" means an account made a request in the last 5 minutes (the app keeps no live connection).
- Suspending takes effect at once: the person is signed out of the app and cannot sign in again until
  restored. Admins cannot suspend themselves or other admins.
