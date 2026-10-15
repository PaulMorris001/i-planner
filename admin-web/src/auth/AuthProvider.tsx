import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { setUnauthorizedHandler } from '@/lib/api';

export type AuthStatus = 'loading' | 'signedOut' | 'notAdmin' | 'admin';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  const value = useMemo(() => ({ status, user, signIn, logout }), [status, user, signIn, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
