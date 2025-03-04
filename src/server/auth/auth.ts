import { env } from "@/lib/env";
import NextAuth, { DefaultSession } from "next-auth";
import { cache } from "react";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      email: string;
    } & DefaultSession["user"];
  }
}

const {
  handlers,
  signIn,
  signOut,
  auth: uncachedAuth,
} = NextAuth({
  providers: [
    {
      id: "dex",
      name: "Dex",
      type: "oidc",
      issuer: env.DEX_ISSUER,
      clientId: env.DEX_CLIENT_ID,
      clientSecret: env.DEX_CLIENT_SECRET,
      authorization: { params: { scope: "openid email profile groups offline_access" } },
      idToken: true,
      checks: ["pkce", "state"],
      wellKnown: env.DEX_WELL_KNOWN_URL,
    },
  ],
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-out",
  },
});

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
