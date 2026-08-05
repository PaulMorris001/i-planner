import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useIAP, ErrorCode } from 'expo-iap';
import type { ProductSubscription, Purchase } from 'expo-iap';
import { subscriptionService } from '@/services/subscription.service';
import type { SubscriptionTier } from '@/types/subscription.types';

// Product ids created in App Store Connect / Play Console — see app/plans.tsx
// for the full tier list these map back to (backend/src/controllers/
// subscription.controller.ts derives the tier from whichever of these
// substrings the verified productId contains).
export const PRODUCT_IDS = [
  'student_monthly',
  'student_annual',
  'professional_monthly',
  'professional_annual',
  'premium_monthly',
  'premium_annual',
];

interface PurchasesContextValue {
  // False until the store connection is up AND the product catalog has been
  // fetched — plans.tsx uses this to keep every tier's CTA in the existing
  // "Coming soon" disabled state until purchasing can actually work.
  ready: boolean;
  tier: SubscriptionTier;
  subscriptions: ProductSubscription[];
  // Product id currently mid-purchase, for a per-button spinner — null when
  // nothing's in flight.
  purchasing: string | null;
  purchase: (productId: string) => void;
  restorePurchases: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<Purchase | null>(null);
  const [fetchedProducts, setFetchedProducts] = useState(false);

  // The already-known tier from the last time anyone verified a purchase for
  // this user — shown immediately on launch rather than defaulting to "free"
  // until a fresh purchase/reconciliation event happens to fire.
  useEffect(() => {
    subscriptionService
      .get()
      .then((subscription) => setTier(subscription.tier))
      .catch((err) => console.error('[Purchases] failed to load current subscription', err));
  }, []);

  const {
    connected,
    subscriptions,
    activeSubscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases: restorePurchasesIap,
    getActiveSubscriptions,
  } = useIAP({
    // Keep this handler minimal — it can't safely reference finishTransaction
    // (not returned by the hook yet, at the point these options are being
    // built for this same call). The actual verify+finish flow runs in the
    // effect below, once the purchase lands in state and finishTransaction is
    // available in this component's own closure.
    onPurchaseSuccess: (purchase) => setPendingPurchase(purchase),
    onPurchaseError: (error) => {
      setPurchasing(null);
      if (error.code === ErrorCode.UserCancelled) return;
      console.error('[Purchases] purchase failed', error);
    },
  });

  useEffect(() => {
    if (connected && !fetchedProducts) {
      setFetchedProducts(true);
      fetchProducts({ skus: PRODUCT_IDS, type: 'subs' }).catch((err) => {
        console.error('[Purchases] failed to fetch products', err);
      });
    }
  }, [connected, fetchedProducts, fetchProducts]);

  // Verifies a completed purchase against this app's own backend — which
  // talks to Apple/Google directly (backend/src/services/appStoreVerify.ts /
  // googlePlayVerify.ts) — and only finishes/acknowledges the store
  // transaction once that verification actually succeeds. A purchase that
  // fails verification is left unfinished rather than silently granted.
  useEffect(() => {
    if (!pendingPurchase) return;
    const purchase = pendingPurchase;
    setPendingPurchase(null);

    (async () => {
      try {
        const subscription = await subscriptionService.verify({
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          purchaseToken: purchase.purchaseToken ?? '',
        });
        setTier(subscription.tier);
        await finishTransaction({ purchase, isConsumable: false });
      } catch (err) {
        console.error('[Purchases] server verification failed', err);
      } finally {
        setPurchasing(null);
      }
    })();
  }, [pendingPurchase, finishTransaction]);

  // Reconciles this device's currently-active subscriptions with the backend
  // on connect — the only real substitute, in a setup with no store-pushed
  // renewal/cancellation webhooks, for keeping the backend's stored tier from
  // going stale after a renewal happens while the app isn't open.
  useEffect(() => {
    if (!connected) return;
    getActiveSubscriptions().catch((err) => {
      console.error('[Purchases] failed to fetch active subscriptions', err);
    });
  }, [connected, getActiveSubscriptions]);

  useEffect(() => {
    const active = activeSubscriptions.find((s) => s.isActive && s.purchaseToken);
    if (!active?.purchaseToken) return;
    subscriptionService
      .verify({ platform: Platform.OS === 'ios' ? 'ios' : 'android', purchaseToken: active.purchaseToken })
      .then((subscription) => setTier(subscription.tier))
      .catch((err) => console.error('[Purchases] reconciliation verify failed', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubscriptions]);

  const purchaseFn = (productId: string) => {
    setPurchasing(productId);
    requestPurchase({
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
      type: 'subs',
    }).catch((err) => {
      // onPurchaseError already handles the user-cancelled case and clears
      // `purchasing` — this only catches request-level failures that never
      // reach that listener at all (e.g. store not reachable).
      setPurchasing(null);
      console.error('[Purchases] requestPurchase failed', err);
    });
  };

  const restorePurchasesFn = async () => {
    await restorePurchasesIap();
    await getActiveSubscriptions();
  };

  return (
    <PurchasesContext.Provider
      value={{
        ready: connected && fetchedProducts,
        tier,
        subscriptions,
        purchasing,
        purchase: purchaseFn,
        restorePurchases: restorePurchasesFn,
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
