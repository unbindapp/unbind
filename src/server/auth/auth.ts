import { env } from "@/lib/env";
import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { cache } from "react";
import { z } from "zod";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      email: string;
    } & DefaultSession["user"];
    access_token: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    access_token?: string;
    expires_at?: number;
    refresh_token?: string;
    error?: "RefreshTokenError";
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
      // First sign in
      if (account) {
        const newToken: JWT = {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
          iat: Date.now() / 1000,
        };
        return newToken;
      }

      // Token not expired, and has more than 10% life left
      if (
        token.expires_at &&
        token.iat &&
        Date.now() < (token.iat + (token.expires_at - token.iat) * 0.9) * 1000
      ) {
        return token;
      }

      const res: JWT = await refreshTokens(token);
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
    console.log("Old token:", token);
    const url = `${env.DEX_ISSUER}/token`;
    if (!token.refresh_token) {
      throw new Error("No refresh token provided");
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DEX_CLIENT_ID,
        client_secret: env.DEX_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token || "",
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      throw errorResponse;
    }

    const res = await response.json();
    const resParsed = TokenRefreshResponseSchema.parse(res);

    console.log("Refreshed tokens res:", resParsed);

    const expiresAt = Date.now() + resParsed.expires_in * 1000;

    const newToken: JWT = {
      ...token,
      access_token: resParsed.access_token ?? token.access_token,
      expires_at: expiresAt,
      refresh_token: resParsed.refresh_token ?? token.refresh_token,
      iat: Math.round(Date.now() / 1000),
      exp: Math.round(expiresAt / 1000),
    };

    console.log("New token:", newToken);
    return newToken;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshTokenError",
    };
  }
}
