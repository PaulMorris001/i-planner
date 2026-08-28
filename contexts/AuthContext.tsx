import { auth } from "@/config/firebase";
import { accountService } from "@/services/account.service";
import {
  authService,
  mapFirebaseError,
  mapFirebaseUser,
} from "@/services/auth.service";
import type {
  AuthError,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth.types";
import type { User } from "@/types/user.types";
import {
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

// Thrown by deleteAccount when it needs a password to finish, so the caller
// can prompt for one and retry instead of showing a plain error.
export class ReauthRequiredError extends Error {}

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  loading: boolean;
  error: AuthError | null;
  login: (payload: LoginPayload) => ReturnType<typeof authService.login>;
  register: (
    payload: RegisterPayload,
  ) => ReturnType<typeof authService.register>;
  logout: () => Promise<void>;
  deleteAccount: (reauthPassword?: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Single source of truth for Firebase auth state — every screen/component
// that needs `user` reads it from here instead of running its own
// onAuthStateChanged listener, which would flash a "not logged in yet"
// fallback on every mount even after auth had already resolved elsewhere.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(
        firebaseUser
          ? {
              id: firebaseUser.uid,
              email: firebaseUser.email ?? "",
              fullName: firebaseUser.displayName ?? "",
              createdAt:
                firebaseUser.metadata.creationTime ?? new Date().toISOString(),
            }
          : null,
      );
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const login = async (payload: LoginPayload) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authService.login(payload);
      setUser(result.user);
      return result;
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
      const result = await authService.register(payload);
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setUser(mapFirebaseUser(auth.currentUser));
      } else {
        setUser(result.user);
      }
      return result;
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

  // Wipes app data first, then deletes the Firebase Auth account. If the
  // session is too stale, Firebase requires a fresh password before deleting
  // the account — app data ends up gone before the account does, which is
  // harmless since retrying with reauthPassword finishes the job.
  const deleteAccount = async (reauthPassword?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser)
      throw { message: "Not signed in.", field: "general" } as AuthError;

    if (reauthPassword) {
      try {
        const credential = EmailAuthProvider.credential(
          currentUser.email!,
          reauthPassword,
        );
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
      if ((e as { code?: string })?.code === "auth/requires-recent-login") {
        throw new ReauthRequiredError();
      }
      throw mapFirebaseError(e);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        loading,
        error,
        login,
        register,
        logout,
        deleteAccount,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
