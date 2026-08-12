import { getRandomValues } from 'expo-crypto';

type MinimalCrypto = { getRandomValues: typeof getRandomValues };
const g = global as unknown as { crypto?: MinimalCrypto };

if (!g.crypto) {
  // expo-crypto's getRandomValues already matches the Web Crypto contract
  // exactly (fills the typed array in place AND returns it), so it's a
  // direct drop-in — no wrapper needed.
  g.crypto = { getRandomValues };
} else if (typeof g.crypto.getRandomValues !== 'function') {
  g.crypto.getRandomValues = getRandomValues;
}

