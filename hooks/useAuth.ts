import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { authService } from '@/services/auth.service';
import type { LoginPayload, RegisterPayload, AuthError } from '@/types/auth.types';
import type { User } from '@/types/user.types';

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

  const clearError = () => setError(null);

  return { user, initializing, loading, error, login, register, logout, clearError };
}
