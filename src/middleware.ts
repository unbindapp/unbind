import { jwtDecode } from "jwt-decode";
import { encode, getToken, JWT } from "next-auth/jwt";
import { NextMiddleware, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const isRefreshingToken = new Map<string, Promise<JWT>>();
const signInPathname = "/sign-in";

const isProd = process.env.NODE_ENV === "production";
const sessionCookieName = isProd ? "__Secure-authjs.session-token" : "authjs.session-token";
const sessionCookieMaxAge = 60 * 60 * 24 * 14;
const secureCookie = isProd;
const sameSiteCookie = "lax";

const tokenRefreshBuffer = 60 * 15;

const authSecret = process.env.AUTH_SECRET!;
const dexClientId = process.env.DEX_CLIENT_ID!;
const dexClienTVariable = process.env.DEX_CLIENT_SECRET!;
const dexIssuer = process.env.DEX_ISSUER!;

if (!authSecret) throw new Error("AUTH_SECRET is not set");
if (!dexClientId) throw new Error("DEX_CLIENT_ID is not set");
if (!dexClienTVariable) throw new Error("DEX_CLIENT_SECRET is not set");
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
     * - opengraph-image (Open Graph image generation)
     * - twitter-image (Twitter image generation)
     */
    "/((?!api/auth|api-internal/auth|_next/static|_next/image|favicon.ico|opengraph-image\\?|twitter-image\\?|.*\\.(?:jpg|jpeg|gif|png|svg|ico|css|js)).*)",
  ],
};

export const middleware: NextMiddleware = async (request: NextRequest) => {
  console.log(process.env.PROJECT_VAR_TEST);
  console.log(process.env.TEAM_VAR_TEST);
  console.log(process.env.VAR1);
  console.log(process.env.VAR2);
  console.log(process.env.VAR3);
  console.log(process.env.VAR4);

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

  const shouldUpdate = shouldUpdateToken(token);
  if (!shouldUpdate && request.nextUrl.pathname === signInPathname) {
    return NextResponse.redirect(homeUrl);
  }

  if (shouldUpdate) {
    try {
      const newTokensObject = await refreshAccessToken(token);
      const sessionCookieValue = await encode({
        maxAge: sessionCookieMaxAge + 60 * 60 * 24,
        secret: authSecret,
        token: newTokensObject,
        salt: sessionCookieName,
      });
      response = getResponseWithSessionCookie(sessionCookieValue, request, response);
    } catch (error) {
      console.log("Error refreshing token: ", error);
      response = NextResponse.redirect(signInUrl);
      response.cookies.set(sessionCookieName, "", {
        httpOnly: true,
        maxAge: -1,
        secure: secureCookie,
        sameSite: sameSiteCookie,
      });
    } finally {
      if (token.refresh_token) {
        isRefreshingToken.delete(token.refresh_token);
      }
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

  const shouldUpdate = Date.now() >= accessTokenExpiresAt * 1000 - tokenRefreshBuffer * 1000;
  return shouldUpdate;
}

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  const refreshToken = token?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token found in token");

  console.log("Refreshing token");
  const existingRefreshPromise = isRefreshingToken.get(refreshToken);
  if (existingRefreshPromise) {
    console.log("Token is already being refreshed, awaiting existing refresh operation");
    const newTokensObj = await existingRefreshPromise;
    return newTokensObj;
  }

  const refresh = async () => {
    try {
      const url = `${dexIssuer}/token`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: dexClientId,
          client_secret: dexClienTVariable,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),

        credentials: "include",
        method: "POST",
      });

      const resJson = await res.json();

      if (!res.ok) {
        console.log(`refreshAccessToken res is not ok`, resJson);
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
      if (
        token?.refresh_token &&
        newJwt.refresh_token &&
        token.refresh_token !== newJwt.refresh_token
      ) {
        console.log("Refresh token renewed");
      }
      return newJwt;
    } catch (e) {
      console.error("refreshAccessToken error:", e);
      throw new Error("RefreshTokenError");
    }
  };

  const refreshPromise = refresh();
  isRefreshingToken.set(refreshToken, refreshPromise);
  const newTokenObj = await refreshPromise;
  return newTokenObj;
}

const TokenRefreshResponseSchema = z
  .object({
    access_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
    refresh_token: z.string(),
    id_token: z.string(),
  })
  .strip();

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    access_token_expires_at?: number;
    expires_at?: number;
    refresh_token?: string;
    error?: "RefreshTokenError";
  }
}
