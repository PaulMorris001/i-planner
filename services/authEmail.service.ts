import { apiRequest } from "./api";
import { authedRequest } from "./authedRequest";

// This install's id + label (utils/deviceId.ts) — lets the backend tell a
// sign-in from a new device apart from a familiar one.
type DeviceInfo = { deviceId: string; deviceLabel: string };

export const authEmailService = {
  // Best-effort notifications — callers fire these without awaiting so a
  // Resend hiccup can never block or fail sign-up/sign-in itself.
  sendWelcome: (fullName: string | undefined, device: DeviceInfo) =>
    authedRequest<void>("/auth/welcome", { method: "POST", body: { fullName, ...device } }),

  // Only actually emails when this is a device the account hasn't used before.
  sendLoginNotify: (fullName: string | undefined, device: DeviceInfo) =>
    authedRequest<void>("/auth/login-notify", { method: "POST", body: { fullName, ...device } }),

  // Unauthenticated — the user isn't signed in yet at this point.
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } }),
};
