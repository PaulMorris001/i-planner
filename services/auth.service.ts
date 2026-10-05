import { auth } from "@/config/firebase";
import { authEmailService } from "@/services/authEmail.service";
import { getDeviceInfo } from "@/utils/deviceId";
import { clearPendingReferralCode, savePendingReferralCode } from "@/utils/referralPending";
import type {
  AuthError,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth.types";
import type { User } from "@/types/user.types";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";

export function mapFirebaseUser(user: FirebaseUser): User {
  return {
    id: user.uid,
    email: user.email ?? "",
    fullName: user.displayName ?? "",
    createdAt: user.metadata.creationTime ?? new Date().toISOString(),
  };
}

export function mapFirebaseError(err: unknown): AuthError {
  const code = (err as { code?: string })?.code ?? "";

  switch (code) {
    case "auth/email-already-in-use":
      return {
        message: "An account with this email already exists.",
        field: "email",
      };
    case "auth/invalid-email":
      return { message: "That email address looks invalid.", field: "email" };
    case "auth/weak-password":
      return {
        message: "Password must be at least 6 characters.",
        field: "password",
      };
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return { message: "Invalid credentials.", field: "general" };
    case "auth/too-many-requests":
      return {
        message: "Too many attempts. Please try again later.",
        field: "general",
      };
    case "auth/network-request-failed":
      return {
        message: "Network error. Check your connection and try again.",
        field: "general",
      };
    default:
      return {
        message:
          (err as Error)?.message ?? "Something went wrong. Please try again.",
        field: "general",
      };
  }
}

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        payload.email,
        payload.password,
      );
      // Not awaited — a Resend/backend hiccup here must never block or fail
      // an otherwise-successful sign-in.
      getDeviceInfo()
        .then((device) => authEmailService.sendLoginNotify(cred.user.displayName ?? undefined, device))
        .catch((err) => console.error("[auth] failed to send login-notify email", err));
      return { user: mapFirebaseUser(cred.user) };
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const referralCode = payload.referralCode?.trim();
    // Remembered BEFORE the account exists: signing in triggers the referral loader
    // the instant the account is created, and it has to find the code waiting.
    if (referralCode) await savePendingReferralCode(referralCode);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        payload.email,
        payload.password,
      );
      await updateProfile(cred.user, { displayName: payload.fullName });
      // Not awaited — same reasoning as login's sendLoginNotify above.
      getDeviceInfo()
        .then((device) => authEmailService.sendWelcome(payload.fullName, device))
        .catch((err) => console.error("[auth] failed to send welcome email", err));
      return { user: mapFirebaseUser(cred.user) };
    } catch (err) {
      // No account was made, so there is nothing for the code to apply to.
      if (referralCode) await clearPendingReferralCode();
      throw mapFirebaseError(err);
    }
  },

  // Routed through our backend (Resend) instead of Firebase's own
  // sendPasswordResetEmail, so the reset email comes from our sender/branding
  // instead of Firebase's default template — see
  // backend/src/controllers/authEmail.controller.ts's forgotPassword, which
  // still generates the same kind of Firebase-hosted reset link under the
  // hood via the Admin SDK.
  forgotPassword: (email: string) => authEmailService.forgotPassword(email),
};
