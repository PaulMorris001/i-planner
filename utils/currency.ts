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
const LOCALE_TAG = deviceLocale?.languageTag ?? 'en-US';

// Standalone symbol (e.g. "₦", "£") for UI that shows it separately from a
// formatted number — e.g. a fixed prefix character next to an amount
// TextInput, where formatCurrency's full "₦1,000" string doesn't fit.
// Derived from the same Intl.NumberFormat call formatCurrency uses (not
// expo-localization's own currencySymbol field directly) so this can never
// drift from what formatCurrency actually renders.
export const CURRENCY_SYMBOL: string = (() => {
  try {
    const parts = new Intl.NumberFormat(LOCALE_TAG, { style: 'currency', currency: CURRENCY_CODE }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? '$';
  } catch {
    return '$';
  }
})();

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
