import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENCY_CODE, formatPrice } from '@/utils/currency';

// Local-currency ESTIMATES of the USD list prices, for app/plans.tsx's fallback
// when the App Store / Play catalog hasn't loaded. The store's own localized
// price always wins when it's available — that's what the user is actually
// charged; these only stop a Nigerian or UK user seeing "$7.99" meanwhile.
//
// Rates: fawazahmed0/currency-api — public domain, no API key, covers NGN/GHS/
// KES etc. (the free ECB-based APIs don't), with a second mirror. Cached for a
// day; if no rate can be had at all, prices stay in USD rather than guessing.

const RATE_URLS = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
];
const CACHE_KEY = 'fx-usd-rate:v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

type CachedRate = { currency: string; rate: number; fetchedAt: number };

async function readCachedRate(): Promise<CachedRate | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as CachedRate) : null;
    return cached?.currency === CURRENCY_CODE && cached.rate > 0 ? cached : null;
  } catch {
    return null;
  }
}

async function fetchRate(): Promise<number | null> {
  const key = CURRENCY_CODE.toLowerCase();
  for (const url of RATE_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) continue;
      const data = (await res.json()) as { usd?: Record<string, number> };
      const rate = data.usd?.[key];
      if (typeof rate === 'number' && rate > 0) return rate;
    } catch {
      // Try the next mirror.
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// USD → device-currency rate, or null (stay in USD). A stale cached rate is
// still used when a refresh fails — a day-old estimate beats none.
export function useUsdRate(): number | null {
  const [rate, setRate] = useState<number | null>(CURRENCY_CODE === 'USD' ? 1 : null);

  useEffect(() => {
    if (CURRENCY_CODE === 'USD') return;
    let cancelled = false;
    (async () => {
      const cached = await readCachedRate();
      if (cached && !cancelled) setRate(cached.rate);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
      const fresh = await fetchRate();
      if (!fresh || cancelled) return;
      setRate(fresh);
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ currency: CURRENCY_CODE, rate: fresh, fetchedAt: Date.now() }));
      } catch {
        // Cache is a nicety — the rate is already applied.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return rate;
}

// Rounds a converted amount to a believable local price point, the way the
// stores' own price tiers look: ₦12,800 / ₹669 / €6.99 rather than ₦12,784.37.
function toPricePoint(amount: number): { value: number; fractionDigits: number } {
  if (amount >= 1000) return { value: Math.round(amount / 100) * 100, fractionDigits: 0 };
  if (amount >= 100) return { value: Math.max(99, Math.round(amount / 10) * 10 - 1), fractionDigits: 0 };
  return { value: Math.max(0.99, Math.round(amount) - 0.01), fractionDigits: 2 };
}

export interface LocalPrices {
  // True when amounts are converted estimates rather than exact USD list prices.
  estimated: boolean;
  // A recurring price (e.g. $7.99/mo, $79.99/yr), snapped to a local price point.
  price: (usd: number) => string;
  // A derived figure (annual ÷ 12) — converted from the already-rounded annual
  // price so it stays consistent with it, and not re-rounded to a ".99" point.
  monthlyFromAnnual: (annualUsd: number) => string;
}

export function useLocalPrices(): LocalPrices {
  const rate = useUsdRate();
  if (!rate || CURRENCY_CODE === 'USD') {
    return {
      estimated: false,
      price: (usd) => formatPrice(usd, 2, 'USD'),
      monthlyFromAnnual: (annualUsd) => formatPrice(annualUsd / 12, 2, 'USD'),
    };
  }
  return {
    estimated: true,
    price: (usd) => {
      const { value, fractionDigits } = toPricePoint(usd * rate);
      return formatPrice(value, fractionDigits);
    },
    monthlyFromAnnual: (annualUsd) => {
      const monthly = toPricePoint(annualUsd * rate).value / 12;
      return formatPrice(monthly, monthly >= 100 ? 0 : 2);
    },
  };
}
