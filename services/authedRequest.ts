import { auth } from "@/config/firebase";
import { signalIfPointEarning } from "@/utils/pointsSignal";
import { apiRequest } from "./api";

type ApiRequestOptions = Parameters<typeof apiRequest>[1];

export async function authedRequest<T>(
  endpoint: string,
  options: Omit<ApiRequestOptions, "token"> = {},
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const result = await apiRequest<T>(endpoint, { ...options, token });
  // A saved task/habit/goal/bill/savings change may have just earned points: the
  // server awards them before it responds, so the total can be re-read now.
  signalIfPointEarning(endpoint, (options as { method?: string }).method);
  return result;
}
