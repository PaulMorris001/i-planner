import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Routes } from '@/constants/routes';
import { useOnboarding } from '@/hooks/useOnboarding';
import { settingsService } from '@/services/settings.service';

// Where to send someone right after signing in. Shared by the email login and the Apple / Google
// buttons, so every way of signing in lands in the same place.
export function usePostSignInRoute() {
  const { completeOnboarding, setFocusProfile } = useOnboarding();

  // An account that was just created: the first-time flow.
  const routeNewUser = () => {
    router.replace(Routes.NOTIFICATIONS_PROMPT);
  };

  // An existing account. The sign-in screens are only reached with no local onboarding state (a
  // fresh install, reinstall or new device) — focusProfile lives in AsyncStorage, so without this
  // check a returning user would silently default to "professional" and never see Focus again.
  // Restore it from Settings if this account already chose one; otherwise this really is a
  // first-time-here device, so send them through Focus like Register does.
  const routeReturningUser = async () => {
    const settings = await settingsService.get();
    if (!settings.focusProfile) {
      router.replace(Routes.NOTIFICATIONS_PROMPT);
      return;
    }
    await setFocusProfile(settings.focusProfile);
    await completeOnboarding();
    // An account having already finished onboarding says nothing about *this device's* OS
    // notification permission — a delete-and-reinstall wipes that back to "undetermined". Route
    // through the prompt once more whenever it's still undetermined; otherwise straight in.
    const { status } = await Notifications.getPermissionsAsync();
    if (status === Notifications.PermissionStatus.UNDETERMINED) {
      router.replace({ pathname: Routes.NOTIFICATIONS_PROMPT, params: { next: 'dashboard' } });
    } else {
      router.replace(Routes.DASHBOARD);
    }
  };

  return { routeNewUser, routeReturningUser };
}
