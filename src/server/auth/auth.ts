import { env } from "@/lib/env";
import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { cache } from "react";
import { z } from "zod";

const refreshRatio = 0.9;

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      email: string;
    } & DefaultSession["user"];
    access_token: string;
  }
}

const {
  handlers,
  signIn,
  signOut,
  auth: uncachedAuth,
} = NextAuth({
  callbacks: {
    jwt: async ({ token, account }) => {
      console.log("JWT callback");

      if (account) {
        console.log("First sign in");
        const newToken: JWT = {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
          iat: Date.now() / 1000,
        };
        return newToken;
      }

      const originalExpiresInMs =
        token.expires_at && token.iat ? (token.expires_at - token.iat) * 1000 : undefined;
      const sinceIssuedMs = token.iat ? Date.now() - token.iat * 1000 : undefined;

      const shouldNotUpdate =
        originalExpiresInMs !== undefined &&
        sinceIssuedMs !== undefined &&
        sinceIssuedMs < originalExpiresInMs * refreshRatio;

      if (shouldNotUpdate) {
        const expiresIn = originalExpiresInMs - sinceIssuedMs;
        console.log(`Token not expired, expires in: ${expiresIn}ms`);
        return token;
      }

      const res = await refreshTokens(token);
      return res;
    },
    session: async ({ session, token }) => {
      return {
        ...session,
        access_token: token.access_token,
        user: session.user,
      };
    },
  },
  providers: [
    {
      id: "dex",
      name: "Dex",
      type: "oidc",
      issuer: env.DEX_ISSUER,
      clientId: env.DEX_CLIENT_ID,
      clientSecret: env.DEX_CLIENT_SECRET,
      authorization: { params: { scope: "openid email profile groups offline_access" } },
      checks: ["pkce", "state"],
      wellKnown: `${env.DEX_ISSUER}/.well-known/openid-configuration`,
    },
  ],
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-out",
  },
});

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    expires_at?: number;
    refresh_token?: string;
    error?: "RefreshTokenError";
  }
}

const TokenRefreshResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
  id_token: z.string(),
});

async function refreshTokens(token: JWT): Promise<JWT> {
  try {
    console.log("Refreshing access token...");
    if (!token.refresh_token) {
      throw new Error("No refresh token provided");
    }

    const url = `${env.DEX_ISSUER}/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DEX_CLIENT_ID,
        client_secret: env.DEX_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      throw errorResponse;
    }

    const res = await response.json();
    const resParsed = TokenRefreshResponseSchema.parse(res);

    console.log("Refreshed tokens");

    const expiresAt = Date.now() + resParsed.expires_in * 1000;

    const newToken: JWT = {
      ...token,
      access_token: resParsed.access_token ?? token.access_token,
      expires_at: expiresAt,
      refresh_token: resParsed.refresh_token ?? token.refresh_token,
      iat: Math.round(Date.now() / 1000),
      exp: Math.round(expiresAt / 1000),
    };

    return newToken;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshTokenError",
    };
  }
}
