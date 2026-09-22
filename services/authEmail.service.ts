import { apiRequest } from "./api";
import { authedRequest } from "./authedRequest";

export const authEmailService = {
  // Best-effort notifications — callers fire these without awaiting so a
  // Resend hiccup can never block or fail sign-up/sign-in itself.
  sendWelcome: (fullName?: string) =>
    authedRequest<void>("/auth/welcome", { method: "POST", body: { fullName } }),

  sendLoginNotify: (fullName?: string) =>
    authedRequest<void>("/auth/login-notify", { method: "POST", body: { fullName } }),

  // Unauthenticated — the user isn't signed in yet at this point.
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }),
};
