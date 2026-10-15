import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { setUnauthorizedHandler } from '@/lib/api';

export type AuthStatus = 'loading' | 'signedOut' | 'notAdmin' | 'admin';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Confirms the current password, then sets the new one. Throws the Firebase error on failure.
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// What Firebase says in words a person understands.
export function friendlySignInError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code === 'auth/user-disabled') return 'This account has been suspended.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  if (code === 'auth/invalid-email') return 'That email address looks invalid.';
  return 'Incorrect email or password.';
}

export const MIN_PASSWORD_LENGTH = 8;

// What Firebase says when changing a password fails, in words a person understands.
export function friendlyPasswordError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Your current password is incorrect.';
  if (code === 'auth/weak-password') return `Choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`;
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  if (code === 'auth/requires-recent-login') return 'For your security, please sign out, sign in again, then change your password.';
  return "Couldn't change your password. Please try again.";
}

// Signed-in state plus the one thing that matters here: whether the account carries the `admin`
// role (a Firebase custom claim). The claim only decides what is SHOWN; the backend checks it again
// on every request, so a non-admin can't use the API even by tampering with this page.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (!next) {
        setStatus('signedOut');
        return;
      }
      setStatus('loading');
      try {
        // Force a fresh token so a role granted a moment ago is seen straight away.
        const result = await next.getIdTokenResult(true);
        setStatus(result.claims.admin === true ? 'admin' : 'notAdmin');
      } catch {
        setStatus('notAdmin');
      }
    });
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  // The server turned the session down (role removed, account suspended): leave the dashboard.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut(auth).catch(() => undefined);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  // Re-checking the current password first is what Firebase requires for a sensitive change, and it
  // stops someone at an unlocked screen from changing it without knowing it.
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = auth.currentUser;
    if (!current?.email) throw { code: 'auth/requires-recent-login' };
    await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, currentPassword));
    await updatePassword(current, newPassword);
  }, []);

  const value = useMemo(() => ({ status, user, signIn, logout, changePassword }), [status, user, signIn, logout, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
