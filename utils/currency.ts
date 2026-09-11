import { getLocales } from 'expo-localization';
import { parseISODateLocal } from './date';

// Device Region setting (Language & Region on iOS, locale on Android) — not
// real geolocation, just the same signal Apple/Google's own storefronts use
// to localize subscription pricing (see app/plans.tsx's displayPrice). Read
// once at module load: the device region doesn't change mid-session, and
// this would otherwise re-resolve on every single formatCurrency call.
// currencyCode/languageTag are null only on web (unsupported here) or a
// locale Expo couldn't resolve — USD/en-US matches this file's old hardcoded
// behavior, so that's the fallback either way.
const deviceLocale = getLocales()[0];
const CURRENCY_CODE = deviceLocale?.currencyCode ?? 'USD';
// NOT deviceLocale.languageTag — Language and Region are independently
// configurable on iOS (e.g. Language "English (U.S.)" with Region "Nigeria"
// is a completely normal setup), and languageTag reflects the Language half.
// Intl.NumberFormat's currency SYMBOL choice (₦ vs the literal "NGN" ISO
// fallback it uses when the locale has no symbol mapping for that currency)
// is tied to the region half specifically — a Nigeria-region device with
// Language left on "English (U.S.)" resolved languageTag to "en-US", which
// correctly knew the currency was NGN but rendered "NGN 2,100" instead of
// "₦2,100" because "en-US" has no Naira symbol mapping. Reconstructing the
// tag from languageCode + regionCode keeps the user's language but forces
// the region half to match what currencyCode was actually resolved from.
const LOCALE_TAG =
  deviceLocale?.languageCode && deviceLocale?.regionCode
    ? `${deviceLocale.languageCode}-${deviceLocale.regionCode}`
    : deviceLocale?.languageTag ?? 'en-US';

// Whole-currency-unit display only (no cents/kobo) — matches every amount in
// the savings-goal/bill UI (values move in whole steps, so fractional units
// never occur). Shows the user's own local currency (e.g. ₦ in Nigeria, £ in
// the UK) instead of always assuming USD.
export function formatCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat(LOCALE_TAG, {
      style: 'currency',
      currency: CURRENCY_CODE,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  } catch {
    // CURRENCY_CODE unrecognized by Intl (rare malformed/unsupported region) —
    // fall back to the previous hardcoded USD formatting rather than crashing
    // every currency display in the app.
    return `$${Math.round(amount).toLocaleString('en-US')}`;
  }
}

// Standalone symbol (e.g. "₦", "£") for UI that shows it separately from a
// formatted number — e.g. a fixed prefix character next to an amount
// TextInput, where formatCurrency's full "₦1,000" string doesn't fit.
// Deliberately NOT Intl.NumberFormat's own formatToParts() — Hermes (React
// Native's JS engine) has documented gaps in its Intl support that don't
// always match Node/V8 (what local testing runs on), and formatToParts is
// exactly the kind of secondary API more likely to be incomplete than the
// plain .format() path formatCurrency above already uses successfully.
// Instead, this reuses formatCurrency itself (proven working) and strips the
// digits/punctuation back out — whatever's left is the symbol, regardless of
// whether it's a prefix ("₦0") or suffix ("0 kr") in a given locale.
export const CURRENCY_SYMBOL: string = formatCurrency(0).replace(/[\d\s.,]/g, '') || '$';

// `targetDateIso` is a real "YYYY-MM-DD" date-key (SavingsGoalModal's date
// picker, via toDateKey) — whole months from today, or null if it doesn't
// parse or is already in the past.
export function monthsUntil(targetDateIso: string): number | null {
  if (!targetDateIso.trim()) return null;
  const target = parseISODateLocal(targetDateIso);
  if (Number.isNaN(target.getTime())) return null;
  const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
  const months = Math.round((target.getTime() - Date.now()) / msPerMonth);
  return months > 0 ? months : null;
}

// "Set aside $X/mo" figure shared by SavingsGoalModal's live preview and
// SavingsGoalCard's display on all three dashboards — null (hidden entirely)
// when the target date doesn't parse or the goal's already fully funded.
export function monthlySavingsAmount(targetAmount: number, savedAmount: number, targetDateIso: string): number | null {
  const months = monthsUntil(targetDateIso);
  const remaining = targetAmount - savedAmount;
  return months && remaining > 0 ? Math.ceil(remaining / months) : null;
}
