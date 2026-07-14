import { useEffect } from 'react';
import { router } from 'expo-router';
import { Routes } from '@/constants/routes';

// Google Calendar OAuth lands here as a deep link (iplanner://oauth2redirect) once the
// backend finishes the token exchange. WebBrowser.openAuthSessionAsync (in
// SettingsContext.connectGoogleCalendar) already captures this URL to resolve its own
// promise, but expo-router independently treats every incoming deep link as a
// navigation target — without a real route here, the user briefly lands on
// "Unmatched Route" instead of bouncing back to the Planner tab.
export default function OAuthRedirect() {
  useEffect(() => {
    router.replace(Routes.PLANNER);
  }, []);
  return null;
}
