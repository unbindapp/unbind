import { getConfig } from "@/lib/config";
import { createClient } from "@/server/go/client.gen";

/**
 * Cookie-session transport for unbind-api.
 *
 * Auth is httpOnly cookies (access_token, refresh_token); the browser never sees a
 * token. Every request sends `credentials: "include"`. The server rotates the access
 * token transparently via the refresh-token cookie — there is no client-driven refresh
 * endpoint — so a 401 means the session is genuinely dead and callers treat it as
 * "signed out" (e.g. the `_authed` route guard redirects to `/sign-in`).
 */
export const apiFetch: typeof fetch = async (input, init) => {
  return fetch(input, { ...init, credentials: "include" });
};

let client: ReturnType<typeof createClient> | null = null;

/** Singleton typed Go SDK bound to the cookie-session fetch wrapper. */
export function getGoClient() {
  if (!client) {
    client = createClient({ apiUrl: getConfig().apiUrl, fetchFn: apiFetch });
  }
  return client;
}
