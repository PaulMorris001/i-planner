import { auth } from "@/config/firebase";
import { signalIfPointEarning } from "@/utils/pointsSignal";
import { apiRequest } from "./api";

type ApiRequestOptions = Parameters<typeof apiRequest>[1];

// Called (once) when the server says this account has been suspended. AuthContext signs the person
// out and tells them why; kept as a tiny subscription so this module does not depend on React.
let suspendedHandler: (() => void) | null = null;
export function setAccountSuspendedHandler(handler: (() => void) | null): void {
  suspendedHandler = handler;
}

export async function authedRequest<T>(
  endpoint: string,
  options: Omit<ApiRequestOptions, "token"> = {},
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  let result: T;
  try {
    result = await apiRequest<T>(endpoint, { ...options, token });
  } catch (err) {
    const failure = err as { status?: number; field?: string } | null;
    if (failure?.status === 403 && failure.field === 'suspended') suspendedHandler?.();
    throw err;
  }
  // A saved task/habit/goal/bill/savings change may have just earned points: the
  // server awards them before it responds, so the total can be re-read now.
  signalIfPointEarning(endpoint, (options as { method?: string }).method);
  return result;
}
