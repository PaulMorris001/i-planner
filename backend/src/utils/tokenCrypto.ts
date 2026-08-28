import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV size for GCM
const AUTH_TAG_LENGTH = 16;
// Distinguishes an encrypted value from a legacy plaintext token (Google's token
// formats never start with this). Lets decryptToken() read old plaintext rows
// as-is with no migration pass; they get encrypted on next write.
const PREFIX = 'enc1:';

function getKey(): Buffer {
  const key = Buffer.from(env.tokenEncryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256.');
  }
  return key;
}

// Encrypts a secret (Google OAuth access/refresh token) for storage at rest —
// see Settings.ts. Never call this on a value that's about to be sent back to
// the client or used in an outgoing API call; only on what's being persisted.
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

// Decrypts a value read from storage back into the real token to use in an
// outgoing Google API call. Passes legacy (pre-encryption) plaintext rows
// through unchanged, and undefined/empty values through unchanged.
export function decryptToken(value: string | undefined): string | undefined {
  if (!value) return value;
  if (!value.startsWith(PREFIX)) return value;

  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
