import type { Subscription } from "@/types/subscription.types";
import { authedRequest } from "./authedRequest";

export const subscriptionService = {
  get: () => authedRequest<Subscription>("/subscription"),

  verify: (input: { platform: "ios" | "android"; purchaseToken: string }) =>
    authedRequest<Subscription>("/subscription/verify", {
      method: "POST",
      body: input,
    }),
};
