import { encode, getToken, JWT } from "next-auth/jwt";
import { NextMiddleware, NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";
import { z } from "zod";

const isRefreshing = new Map<string, boolean>();
const signInPathname = "/sign-in";

const sessionCookieName =
  process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token";
const sessionCookieMaxAge = 60 * 60 * 24 * 14;
const secureCookie = process.env.NODE_ENV === "production";
const sameSiteCookie = process.env.NODE_ENV === "production" ? "strict" : "lax";

const tokenRefreshBuffer = 30;

const authSecret = process.env.AUTH_SECRET!;
const dexClientId = process.env.DEX_CLIENT_ID!;
const dexClientSecret = process.env.DEX_CLIENT_SECRET!;
const dexIssuer = process.env.DEX_ISSUER!;

if (!authSecret) throw new Error("AUTH_SECRET is not set");
if (!dexClientId) throw new Error("DEX_CLIENT_ID is not set");
if (!dexClientSecret) throw new Error("DEX_CLIENT_SECRET is not set");
if (!dexIssuer) throw new Error("DEX_ISSUER is not set");

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, fonts, etc.)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico|css|js)).*)",
  ],
};

export const middleware: NextMiddleware = async (request: NextRequest) => {
  console.log("🔀 Middleware");
  const token = await getToken({
    cookieName: sessionCookieName,
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });

  let response = NextResponse.next();
  const signInUrl = new URL(signInPathname, request.url);
  const homeUrl = new URL("/", request.url);

  if (!token) {
    if (request.nextUrl.pathname === signInPathname) {
      return response;
    }
    return NextResponse.redirect(signInUrl);
  }

  if (token && request.nextUrl.pathname === signInPathname) {
    return NextResponse.redirect(homeUrl);
  }

  const shouldUpdate = shouldUpdateToken(token);
  if (shouldUpdate) {
    try {
      const newTokensObject = await refreshAccessToken(token);
      const sessionCookieValue = await encode({
        maxAge: sessionCookieMaxAge,
        secret: authSecret,
        token: newTokensObject,
        salt: sessionCookieName,
      });
      response = getResponseWithSessionCookie(sessionCookieValue, request, response);
    } catch (error) {
      console.log("Error refreshing token: ", error);
      response = NextResponse.redirect(signInUrl);
      response.cookies.delete(sessionCookieName);
    }
  }

  return response;
};

export function getResponseWithSessionCookie(
  sessionCookieValue: string,
  request: NextRequest,
  response: NextResponse,
): NextResponse<unknown> {
  request.cookies.set(sessionCookieName, sessionCookieValue);
  response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  response.cookies.set(sessionCookieName, sessionCookieValue, {
    httpOnly: true,
    maxAge: sessionCookieMaxAge,
    secure: secureCookie,
    sameSite: sameSiteCookie,
  });

  return response;
}

export function shouldUpdateToken(token: JWT): boolean {
  const accessTokenExpiresAt = token?.access_token_expires_at;
  if (!accessTokenExpiresAt) return true;

  const timeInSeconds = Math.ceil(Date.now() / 1000);
  const shouldUpdate = timeInSeconds >= accessTokenExpiresAt - tokenRefreshBuffer;
  return shouldUpdate;
}

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  const refreshToken = token?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token found in token");

  console.log("Refreshing token");
  if (isRefreshing.get(refreshToken)) {
    console.log("Token is already being refreshed");
    return token;
  }

  isRefreshing.set(refreshToken, true);

  try {
    const url = `${dexIssuer}/token`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: dexClientId,
        client_secret: dexClientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),

      credentials: "include",
      method: "POST",
    });

    const resJson = await res.json();

    if (!res.ok) {
      console.log("Res is not ok:", resJson);
      throw new Error(`Token refresh failed with status: ${res.status}`);
    }

    const newTokensObj = TokenRefreshResponseSchema.parse(resJson);
    const decodedToken = jwtDecode(newTokensObj.access_token);
    const newJwt: JWT = {
      ...token,
      access_token: newTokensObj.access_token ?? token?.access_token,
      access_token_expires_at: decodedToken.exp,
      refresh_token: newTokensObj.refresh_token ?? token?.refresh_token,
    };
    return newJwt;
  } catch (e) {
    console.error("refreshAccessToken error:", e);
  } finally {
    isRefreshing.delete(refreshToken);
  }

  return token;
}

const TokenRefreshResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  id_token: z.string(),
});

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    access_token_expires_at?: number;
    expires_at?: number;
    refresh_token?: string;
    error?: "RefreshTokenError";
  }
}
