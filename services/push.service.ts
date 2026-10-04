import { authedRequest } from "./authedRequest";

export const pushService = {
  register: (token: string, platform: "ios" | "android") =>
    authedRequest<void>("/push/tokens", { method: "POST", body: { token, platform } }),

  unregister: (token: string) =>
    authedRequest<void>("/push/tokens", { method: "DELETE", body: { token } }),
};
