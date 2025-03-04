import { env } from "@/lib/env";
import NextAuth, { DefaultSession } from "next-auth";
import { cache } from "react";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      email: string;
    } & DefaultSession["user"];
    accessToken: string;
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
        token.accessToken = account?.access_token;
      }
      return token;
    },
    session: async ({ session, token }) => {
      return {
        ...session,
        accessToken: token.accessToken,
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
    },
  ],
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-out",
  },
});

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
