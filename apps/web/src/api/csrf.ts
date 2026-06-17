/**
 * The API issues a non-HttpOnly CSRF cookie bound to the session. The SPA echoes
 * it in the X-CSRF-Token header on state-changing requests; the server rejects
 * any cookie-authenticated mutation whose header doesn't match.
 *
 * The cookie is `__Host-csrf_token` when the API uses secure cookies (prod, and
 * any HTTPS dev), and `csrf_token` on a local insecure API — so we accept both.
 */
export function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)(?:__Host-)?csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
