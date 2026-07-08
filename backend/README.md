# I-Planner backend

Express + MongoDB (Mongoose) API server for the I-Planner app.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then edit MONGODB_URI / JWT_SECRET as needed
```

Requires a running MongoDB instance (local `mongod`, Docker, or Atlas) matching `MONGODB_URI`.

## Run

```bash
npm run dev     # ts-node-dev, restarts on change
npm run build    # compile to dist/
npm start        # run compiled dist/index.js
npm run typecheck
```

Server listens on `PORT` (default `4000`), routes mounted under `/api`.

## Endpoints

| Method | Path                     | Body                                  | Notes                          |
|--------|--------------------------|----------------------------------------|---------------------------------|
| GET    | `/api/health`            | —                                      | Liveness check                  |
| POST   | `/api/auth/register`     | `{ fullName, email, password }`       | Returns `{ token, user }`       |
| POST   | `/api/auth/login`        | `{ email, password }`                 | Returns `{ token, user }`       |
| POST   | `/api/auth/forgot-password` | `{ email }`                        | Returns `{ message }`           |

Error responses are `{ message, field? }` with a matching HTTP status, mirroring the shape the
Expo app's `services/api.ts` (`apiRequest`) already expects — so swapping
`services/auth.service.ts` from its current mock to real `apiRequest(...)` calls against this
server is a drop-in change once `EXPO_PUBLIC_API_URL` points here.

## Structure

```
src/
  config/       env loading, MongoDB connection
  models/       Mongoose schemas
  controllers/  request handlers
  routes/       Express routers
  middleware/   auth guard, error handler
  utils/        JWT helpers, ApiError, asyncHandler
```

## Not yet implemented

Only auth is wired up for now, matching what the frontend currently calls. Tasks, plans,
habits, and the AI Coach are still static/mocked on the frontend, so there's no corresponding
API for them yet — add models/routes here as those features get real data.
