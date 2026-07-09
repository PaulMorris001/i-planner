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
};
