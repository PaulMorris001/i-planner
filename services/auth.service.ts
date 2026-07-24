import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import type { LoginPayload, RegisterPayload, AuthResponse, AuthError } from '@/types/auth.types';
import type { User } from '@/types/user.types';

function mapFirebaseUser(user: FirebaseUser): User {
  return {
    id: user.uid,
    email: user.email ?? '',
    fullName: user.displayName ?? '',
    createdAt: user.metadata.creationTime ?? new Date().toISOString(),
  };
}

export function mapFirebaseError(err: unknown): AuthError {
  const code = (err as { code?: string })?.code ?? '';

  switch (code) {
    case 'auth/email-already-in-use':
      return { message: 'An account with this email already exists.', field: 'email' };
    case 'auth/invalid-email':
      return { message: 'That email address looks invalid.', field: 'email' };
    case 'auth/weak-password':
      return { message: 'Password must be at least 6 characters.', field: 'password' };
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return { message: 'Invalid credentials.', field: 'general' };
    case 'auth/too-many-requests':
      return { message: 'Too many attempts. Please try again later.', field: 'general' };
    case 'auth/network-request-failed':
      return { message: 'Network error. Check your connection and try again.', field: 'general' };
    default:
      return { message: (err as Error)?.message ?? 'Something went wrong. Please try again.', field: 'general' };
  }
}

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    try {
      const cred = await signInWithEmailAndPassword(auth, payload.email, payload.password);
      return { user: mapFirebaseUser(cred.user) };
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
      await updateProfile(cred.user, { displayName: payload.fullName });
      return { user: mapFirebaseUser(cred.user) };
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  forgotPassword: async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { message: 'Reset link sent.' };
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },
};
