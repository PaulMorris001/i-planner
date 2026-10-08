import { router } from 'expo-router';
import { Routes, type AppRoute } from '@/constants/routes';

// Goes back one screen. When there is no screen behind this one (the app was just opened by a
// link or a notification, so the stack starts here) it goes to `fallbackRoute` instead of doing
// nothing, which is what a bare router.back() does.
export function goBackOr(fallbackRoute: AppRoute = Routes.DASHBOARD): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallbackRoute);
}

// Opens `path` on top of `parentRoute`, so Back from it lands on the parent. A link that launches
// the app starts with an empty history; replacing straight to the target would leave Back with
// nowhere to go.
export function openOnTopOf(parentRoute: AppRoute, path: string): void {
  router.replace(parentRoute);
  router.push(path as Parameters<typeof router.push>[0]);
}
