import crypto from 'crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// URL-safe random ID for public share links. 10 base62 characters is ~59.5
// bits of entropy: short enough to read and type, still far beyond
// brute-forcing against the API. Rejection sampling (discarding bytes >= 248,
// the largest multiple of 62 under 256) keeps every character equally likely.
export function shortId(length = 10): string {
  let id = '';
  while (id.length < length) {
    for (const byte of crypto.randomBytes(length * 2)) {
      if (byte < 248) id += ALPHABET[byte % 62];
      if (id.length === length) break;
    }
  }
  return id;
}
