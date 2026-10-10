import { auth } from "@/config/firebase";
import { accountService } from "@/services/account.service";
import {
  authService,
  mapFirebaseError,
  mapFirebaseUser,
} from "@/services/auth.service";
import {
  socialAuthService,
  type SocialProvider,
  type SocialSignInResult,
} from "@/services/socialAuth.service";
import type {
  AuthError,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth.types";
import type { User } from "@/types/user.types";
import { cancelAllDeviceReminders } from "@/utils/notificationReconcile";
import { unregisterPushToken } from "@/utils/pushNotifications";
import { clearPendingReferralCode } from "@/utils/referralPending";
import {
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  revokeAccessToken,
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
  // Apple / Google. Resolves to null when the person closed the sign-in sheet.
  socialSignIn: (
    provider: SocialProvider,
    options?: { referralCode?: string },
  ) => Promise<SocialSignInResult | null>;
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

  const socialSignIn = async (
    provider: SocialProvider,
    options?: { referralCode?: string },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await socialAuthService.signIn(provider, options);
      if (result) setUser(result.user);
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
    // Local notifications outlive the session — without this, the signed-out
    // account's task/bill/class reminders keep firing on this device (or for
    // whoever signs in next). Signing back in reschedules them via reconcile.
    await cancelAllDeviceReminders();
    // Before signOut — the backend call needs the still-valid session.
    await unregisterPushToken();
    // A referral code that never reached the server belonged to this account only.
    await clearPendingReferralCode();
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

    // Signed in with Apple or Google: there is no password, so the person confirms with their
    // provider again. For Apple, its tokens are also revoked, which App Store rules require when an
    // account is deleted. All of this happens BEFORE any data is wiped, so closing the sheet
    // leaves everything as it was.
    const socialProvider = socialAuthService.providerOf(currentUser);
    if (socialProvider) {
      const confirmed = await socialAuthService.reauthenticate(currentUser, socialProvider);
      if (!confirmed) {
        throw {
          message: "Sign in again to confirm deleting your account.",
          field: "general",
        } as AuthError;
      }
      if (confirmed.authorizationCode) {
        await revokeAccessToken(auth, confirmed.authorizationCode).catch((e) =>
          console.error("[auth] could not revoke the Apple tokens", e),
        );
      }
      await accountService.deleteData();
      await cancelAllDeviceReminders();
      try {
        await deleteUser(currentUser);
      } catch (e) {
        throw mapFirebaseError(e);
      }
      return;
    }

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
      await cancelAllDeviceReminders();
      return;
    }

    await accountService.deleteData();
    // The data behind every reminder is gone now, whether or not the auth
    // deletion below needs a re-login first.
    await cancelAllDeviceReminders();
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
        socialSignIn,
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
