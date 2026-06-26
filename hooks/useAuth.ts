import { useState } from 'react';
import { authService } from '@/services/auth.service';
import type { LoginPayload, RegisterPayload, AuthError } from '@/types/auth.types';
import type { User } from '@/types/user.types';

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<AuthError | null>(null);

  const login = async (payload: LoginPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.login(payload);
      setUser(res.user);
      return res;
    } catch (e: any) {
      const err: AuthError = {
        message: e?.message ?? 'Login failed. Please try again.',
        field: e?.field ?? 'general',
      };
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
      const res = await authService.register(payload);
      setUser(res.user);
      return res;
    } catch (e: any) {
      const err: AuthError = {
        message: e?.message ?? 'Registration failed. Please try again.',
        field: e?.field ?? 'general',
      };
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return { user, loading, error, login, register, logout, clearError };
}