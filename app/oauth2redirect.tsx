import { useEffect } from 'react';
import { router } from 'expo-router';
import { Routes } from '@/constants/routes';

// Google Calendar OAuth lands here as a deep link (iplanner://oauth2redirect) once the
// backend finishes the token exchange.
export default function OAuthRedirect() {
  useEffect(() => {
    router.replace(Routes.PLANNER);
  }, []);
  return null;
}
  