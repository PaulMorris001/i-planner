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
  // Either FIREBASE_SERVICE_ACCOUNT_JSON directly, or GOOGLE_APPLICATION_CREDENTIALS
  // pointing at a key file.
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  // Google Calendar OAuth backend-relay flow — see routes/googleOAuth.routes.ts.
  googleOAuthClientId: required('GOOGLE_OAUTH_CLIENT_ID'),
  googleOAuthClientSecret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
  googleOAuthStateSecret: required('GOOGLE_OAUTH_STATE_SECRET'),
  // Outlook Calendar import (read-only) — same backend-relay shape as Google
  // above, see routes/microsoftOAuth.routes.ts. Optional (unlike Google's),
  // so deploying this code doesn't crash the running backend before the
  // Azure app registration exists — startMicrosoftCalendarConnect throws a
  // clean "not configured" error per-request instead when unset.
  microsoftOAuthClientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
  microsoftOAuthClientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
  backendPublicUrl: required('BACKEND_PUBLIC_URL'),
  openaiApiKey: required('OPENAI_API_KEY'),
  // AES-256 key (32 bytes, base64) encrypting Settings.googleAccessToken/googleRefreshToken
  // at rest — see utils/tokenCrypto.ts. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  tokenEncryptionKey: required('TOKEN_ENCRYPTION_KEY'),
  // IAP verification, direct against Apple/Google. All optional: unset just makes
  // purchase verification throw a "not configured" error per-request instead of
  // crashing startup.
  // App Store Connect → App Information → Bundle ID.
  appleBundleId: process.env.APPLE_BUNDLE_ID,
  // App Store Connect → App Information → "Apple ID" — numeric, not the bundle id.
  // Only required for Production transactions; Sandbox doesn't need it.
  appleAppId: process.env.APPLE_APP_ID ? Number(process.env.APPLE_APP_ID) : undefined,
  // Play Console → Setup → API access service account with "View financial data"
  // access — paste the full downloaded JSON key as one line.
  googlePlayServiceAccountJson: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
  // Matches app.json's expo.android.package.
  googlePlayPackageName: process.env.GOOGLE_PLAY_PACKAGE_NAME,
  // resend.com dashboard → API Keys. Optional: unset just makes sendEmail
  // (utils/email.ts) throw a clean "not configured" error per-call instead of
  // crashing startup, same shape as the Microsoft OAuth/IAP vars above.
  resendApiKey: process.env.RESEND_API_KEY,
  // resend.com dashboard → Domains — must be a verified sending domain/address,
  // not an arbitrary address, or Resend will reject the send.
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
};
