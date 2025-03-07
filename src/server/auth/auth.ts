import { env } from "@/lib/env";
import NextAuth, { DefaultSession } from "next-auth";
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

const {
  handlers,
  signIn,
  signOut,
  auth: uncachedAuth,
} = NextAuth({
  callbacks: {
    jwt: async ({ token, account }) => {
      if (account) {
        const newToken: JWT = {
          ...token,
          access_token: account.access_token,
          access_token_expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        };
        if (account.expires_at) {
          console.log("EXPIRES AT: ", new Date(account.expires_at * 1000).toISOString());
        }
        return newToken;
      }

      return token;
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
