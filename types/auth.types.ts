export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  // Optional code from a friend; both of you earn points (see ReferralContext).
  referralCode?: string;
}

export interface AuthResponse {
  user: import('./user.types').User;
}

export interface AuthError {
  message: string;
  field?: 'email' | 'password' | 'fullName' | 'general';
}