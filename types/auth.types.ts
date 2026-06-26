export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: import('./user.types').User;
}

export interface AuthError {
  message: string;
  field?: 'email' | 'password' | 'fullName' | 'general';
}