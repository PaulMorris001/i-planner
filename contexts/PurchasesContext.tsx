import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { subscriptionService } from '@/services/subscription.service';
import type { SubscriptionTier } from '@/types/subscription.types';

// Product ids created in App Store Connect / Play Console — kept here as the
// canonical list app/plans.tsx maps its tier cards to, even while purchasing
// itself is disabled below.
export const PRODUCT_IDS = [
  'student_monthly',
  'student_annual',
  'professional_monthly',
  'professional_annual',
  'premium_monthly',
  'premium_annual',
];

// expo-iap is temporarily uninstalled entirely (not just unused) — TestFlight
// builds 8, 9, and 10 all crashed within ~300ms of launch with an identical
// signature: a SIGSEGV inside React Native's own bridge
// (ObjCTurboModule::performVoidMethodInvocation / convertNSExceptionToJSError)
// on two unrelated devices/iOS versions. Build 10 disabled expo-iap's JS
// usage (never called useIAP()) and it crashed identically — but that only
// proved the JS-level call wasn't the trigger. The actual failure appears to
// happen at native TurboModule *registration* time, before any JS runs
// (matching github.com/revenuecat/react-native-purchases#1712's report of
// the same crash signature), which a linked-but-unused package doesn't
// avoid. Fully removing the dependency is the real test. Reinstall
// (`npx expo install expo-iap`) and restore the useIAP()-based provider once
// this is resolved upstream or conclusively ruled out.
interface PurchasesContextValue {
  ready: boolean;
  tier: SubscriptionTier;
  purchasing: string | null;
  purchase: (productId: string) => void;
  restorePurchases: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

export function PurchasesProvider({ children }: { children: ReactNode }) {
  // Reads the already-known tier from the backend so a previously-verified
  // subscriber still sees their real tier even while live purchasing is
  // disabled.
  const [tier, setTier] = useState<SubscriptionTier>('free');
  useEffect(() => {
    subscriptionService
      .get()
      .then((subscription) => setTier(subscription.tier))
      .catch((err) => console.error('[Purchases] failed to load current subscription', err));
  }, []);

  return (
    <PurchasesContext.Provider
      value={{
        ready: false,
        tier,
        purchasing: null,
        purchase: () => {
          console.warn('[Purchases] purchasing is temporarily disabled');
        },
        restorePurchases: async () => {},
      }}
    >
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be used within a PurchasesProvider');
  return ctx;
}
