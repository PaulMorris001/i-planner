import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { authService, mapFirebaseError } from '@/services/auth.service';
import { accountService } from '@/services/account.service';
import type { LoginPayload, RegisterPayload, AuthError } from '@/types/auth.types';
import type { User } from '@/types/user.types';

// Distinguishes "need a password to finish" from a real failure — thrown by
// deleteAccount so the caller can prompt for a password and retry, rather
// than showing this as a plain error.
export class ReauthRequiredError extends Error {}

export function useAuth() {
  const [user, setUser]                 = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<AuthError | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(
        firebaseUser
          ? {
              id: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              fullName: firebaseUser.displayName ?? '',
              createdAt: firebaseUser.metadata.creationTime ?? new Date().toISOString(),
            }
          : null
      );
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const login = async (payload: LoginPayload) => {
    setLoading(true);
    setError(null);
    try {
      return await authService.login(payload);
    } catch (e) {
      const err = e as AuthError;
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    setError(null);
    try {
      return await authService.register(payload);
    } catch (e) {
      const err = e as AuthError;
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setError(null);
  };

  // Wipes all app data first (needs a still-valid session), then deletes the
  // Firebase Auth account itself. If the session is too old, Firebase requires
  // a fresh password before it'll allow deleting the account — that's the one
  // case where app data ends up gone before the account does; harmless, since
  // signing back in would just show an empty account, and retrying with the
  // password (via reauthPassword) finishes the job.
  const deleteAccount = async (reauthPassword?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw { message: 'Not signed in.', field: 'general' } as AuthError;

    if (reauthPassword) {
      try {
        const credential = EmailAuthProvider.credential(currentUser.email!, reauthPassword);
        await reauthenticateWithCredential(currentUser, credential);
      } catch (e) {
        throw mapFirebaseError(e);
      }
      await deleteUser(currentUser);
      return;
    }

    await accountService.deleteData();
    try {
      await deleteUser(currentUser);
    } catch (e) {
      if ((e as { code?: string })?.code === 'auth/requires-recent-login') {
        throw new ReauthRequiredError();
      }
      throw mapFirebaseError(e);
    }
  };

  const clearError = () => setError(null);

  return { user, initializing, loading, error, login, register, logout, deleteAccount, clearError };
}
