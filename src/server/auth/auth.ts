import { env } from "@/lib/env";
import NextAuth, { DefaultSession } from "next-auth";
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
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        };
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
