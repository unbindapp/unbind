import { readCsrfToken } from "@/api/csrf";
import { getConfig } from "@/lib/config";
import { createClient } from "@/server/go/client.gen";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie-session transport for unbind-api.
 *
 * Auth is httpOnly cookies (access_token, refresh_token); the browser never sees a
 * token. Every request sends `credentials: "include"`. The server rotates the access
 * token transparently via the refresh-token cookie — there is no client-driven refresh
 * endpoint — so a 401 means the session is genuinely dead and callers treat it as
 * "signed out" (e.g. the root route guard redirects to `/sign-in`).
 */
export const apiFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);

  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  return fetch(input, { ...init, credentials: "include", headers });
};

let client: ReturnType<typeof createClient> | null = null;

/** Singleton typed Go SDK bound to the cookie-session fetch wrapper. */
export function getGoClient() {
  if (!client) {
    client = createClient({ apiUrl: getConfig().apiUrl, fetchFn: apiFetch });
  }
  return client;
}
