import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI', 'mongodb://localhost:27017/i-planner'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  // Either set FIREBASE_SERVICE_ACCOUNT_JSON directly, or leave unset and rely on
  // GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key file.
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  // Google Calendar OAuth (backend-relay flow — see routes/googleOAuth.routes.ts).
  googleOAuthClientId: required('GOOGLE_OAUTH_CLIENT_ID'),
  googleOAuthClientSecret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
  googleOAuthStateSecret: required('GOOGLE_OAUTH_STATE_SECRET'),
  backendPublicUrl: required('BACKEND_PUBLIC_URL'),
  openaiApiKey: required('OPENAI_API_KEY'),
  // AES-256 key (32 bytes, base64) encrypting Settings.googleAccessToken/
  // googleRefreshToken at rest — see utils/tokenCrypto.ts. Generate one with:
  // node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
  // In-app purchases — verified directly against Apple/Google, no third-party
  // service in between (see services/appStoreVerify.ts / googlePlayVerify.ts).
  // All optional for now since none of the store-side setup exists yet;
  // left unset, purchase verification just throws a clear "not configured"
  // error per-request instead of crashing the whole backend on startup.
  //
  // App Store Connect → App Information → Bundle ID.
  appleBundleId: process.env.APPLE_BUNDLE_ID,
  // App Store Connect → App Information → "Apple ID" — a *numeric* id, not
  // the bundle id (confusingly also just called "the app's Apple ID"). Only
  // required for verifying Production transactions; Sandbox doesn't need it.
  appleAppId: process.env.APPLE_APP_ID ? Number(process.env.APPLE_APP_ID) : undefined,
  // Google Cloud Console service account (Play Console → Setup → API access →
  // link/create one, grant it "View financial data" access) — paste the full
  // downloaded JSON key as a single line, same pattern as
  // FIREBASE_SERVICE_ACCOUNT_JSON above.
  googlePlayServiceAccountJson: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
  // The app's Android package name (matches app.json's expo.android.package).
  googlePlayPackageName: process.env.GOOGLE_PLAY_PACKAGE_NAME,
};
