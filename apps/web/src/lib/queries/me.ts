import { queryOptions } from "@tanstack/react-query";

import { apiFetch } from "@/lib/server/client";
import { getConfig } from "@/lib/config";
import type { MeResponseBody } from "@/lib/server/client.gen";

export type Me = MeResponseBody["data"];

export const queryKeyMe = ["me"] as const;

/**
 * Session = "does GET /users/me return 200". We call the endpoint through the
 * cookie-session fetch wrapper (which transparently refreshes on a recoverable
 * 401) and treat a final 401 as "not signed in" (null) rather than an error.
 */
export const meQuery = queryOptions({
  queryKey: queryKeyMe,
  queryFn: async (): Promise<Me | null> => {
    const res = await apiFetch(`${getConfig().apiUrl}/users/me`);
    if (res.status === 401) return null;
    if (!res.ok) throw new Error("Failed to load session");
    const json = (await res.json()) as MeResponseBody;
    return json.data;
  },
  staleTime: 5 * 60 * 1000,
});
