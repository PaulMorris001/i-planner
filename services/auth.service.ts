import type { LoginPayload, RegisterPayload, AuthResponse } from '@/types/auth.types';

const mockUser = {
  id: '1',
  email: 'test@university.edu',
  fullName: 'Ada Okafor',
  institution: 'University of Lagos',
  createdAt: new Date().toISOString(),
};

const mockDelay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    await mockDelay(1000);
    if (payload.email && payload.password) {
      return { token: 'mock-token-123', user: mockUser };
    }
    throw { message: 'Invalid credentials.', field: 'general' };
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    await mockDelay(1000);
    if (payload.email && payload.password && payload.fullName) {
      return {
        token: 'mock-token-123',
        user: { ...mockUser, email: payload.email, fullName: payload.fullName },
      };
    }
    throw { message: 'Registration failed.', field: 'general' };
  },

  forgotPassword: async (email: string) => {
    await mockDelay(800);
    if (email) return { message: 'Reset link sent.' };
    throw { message: 'Email not found.', field: 'email' };
  },
};