# I-Planner backend

Express + MongoDB (Mongoose) API server for the I-Planner app.

Authentication is handled entirely client-side by **Firebase Auth** — this server doesn't
issue its own sessions or store passwords. It only verifies Firebase ID tokens (via
`firebase-admin`) on whatever protected routes get added as real data endpoints (tasks,
plans, habits, etc.) come online.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then edit MONGODB_URI / Firebase settings as needed
```

Requires a running MongoDB instance (local `mongod`, Docker, or Atlas) matching `MONGODB_URI`.

For Firebase Admin credentials, either:
1. Paste a service account JSON (Firebase console → Project settings → Service accounts →
   Generate new private key) as a single-line string into `FIREBASE_SERVICE_ACCOUNT_JSON`, or
2. Point `GOOGLE_APPLICATION_CREDENTIALS` at the downloaded key file path instead and leave
   `FIREBASE_SERVICE_ACCOUNT_JSON` blank.

## Run

```bash
npm run dev     # ts-node-dev, restarts on change
npm run build    # compile to dist/
npm start        # run compiled dist/index.js
npm run typecheck
```

Server listens on `PORT` (default `4000`), routes mounted under `/api`.

## Endpoints

| Method | Path          | Notes            |
|--------|---------------|-------------------|
| GET    | `/api/health` | Liveness check    |

No auth endpoints live here — the app calls Firebase Auth directly (`services/auth.service.ts`
on the frontend). When a protected data route is needed, mount it behind the `requireAuth`
middleware, which expects `Authorization: Bearer <firebaseIdToken>` (get the token from the
app via `auth.currentUser.getIdToken()`) and sets `req.userId` to the Firebase UID.

## Structure

```
src/
  config/       env loading, MongoDB connection, Firebase Admin init
  models/       Mongoose schemas (empty for now — add as real data endpoints are built)
  controllers/  request handlers (empty for now)
  routes/       Express routers
  middleware/   requireAuth (Firebase token verification), error handler
  utils/        ApiError, asyncHandler
```

## Not yet implemented

Only the `/health` check exists. Tasks, plans, habits, and the AI Coach are still
static/mocked on the frontend, so there's no corresponding API for them yet — add
models/controllers/routes here, protected by `requireAuth`, as those features get real data.
