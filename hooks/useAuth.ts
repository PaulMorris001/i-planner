import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';
import type { LoginPayload, RegisterPayload, AuthError, AuthResponse } from '@/types/auth.types';
import type { User } from '@/types/user.types';

const SESSION_KEY = '@iplanner_auth_session';

interface StoredSession {
  token: string;
  user: User;
}

export function useAuth() {
  const [user, setUser]                 = useState<User | null>(null);
  const [token, setToken]               = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<AuthError | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then((raw) => {
      if (raw) {
        const session: StoredSession = JSON.parse(raw);
        setUser(session.user);
        setToken(session.token);
      }
      setInitializing(false);
    });
  }, []);

  const persistSession = async (res: AuthResponse) => {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ token: res.token, user: res.user }));
    setUser(res.user);
    setToken(res.token);
  };

  const login = async (payload: LoginPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.login(payload);
      await persistSession(res);
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
      await persistSession(res);
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

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
    setToken(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return { user, token, initializing, loading, error, login, register, logout, clearError };
}
