import { getRandomValues } from 'expo-crypto';

type MinimalCrypto = { getRandomValues: typeof getRandomValues };
const g = global as unknown as { crypto?: MinimalCrypto };

if (!g.crypto) {
  g.crypto = { getRandomValues };
} else if (typeof g.crypto.getRandomValues !== 'function') {
  g.crypto.getRandomValues = getRandomValues;
}

