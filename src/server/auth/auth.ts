import { env } from "@/lib/env";
import NextAuth, { DefaultSession, Account } from "next-auth";
import { JWT } from "next-auth/jwt";
import { cache } from "react";

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
    access_token: string
    expires_at: number
    refresh_token?: string
    error?: "RefreshTokenError"
  }
}

interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  id_token: string;
}

async function refreshAccessToken(token: JWT) {
  try {
    console.log("Refreshing access token...", token);
    const url = `${env.DEX_ISSUER}/token`; 
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
      throw errorResponse
    }

    const refreshedTokens = await response.json() as TokenRefreshResponse ;

    const expiresAt = Date.now() + (refreshedTokens.expires_in * 1000);

    return {
      ...token,
      access_token: refreshedTokens.access_token,
      expires_at: expiresAt,
      refresh_token: refreshedTokens.refresh_token ?? token.refresh_token,
      iat: Date.now() / 1000,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshTokenError",
    };
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
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
          iat: Date.now() / 1000,
        } as JWT;
      }

      console.log("JWT", token);

      // Token not expired, and has more than 10% life left
      if (token.iat && Date.now() < (token.iat + (token.expires_at - token.iat) * 0.9) * 1000) {
        return token;
      }

       const r = await refreshAccessToken(token) as JWT;
       console.log("Refreshed token", r);
       return r;
    },
    session: async ({ session, token }) => {
      return {
        ...session,
        accessToken: token.access_token,
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
