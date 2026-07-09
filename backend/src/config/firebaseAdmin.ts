import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env';

function buildCredential() {
  if (env.firebaseServiceAccountJson) {
    return cert(JSON.parse(env.firebaseServiceAccountJson));
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS or the platform's default service account.
  return applicationDefault();
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: buildCredential(), projectId: env.firebaseProjectId });

export const firebaseAuth = getAuth(app);
