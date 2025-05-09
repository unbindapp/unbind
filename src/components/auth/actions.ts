"use server";

import { signIn, signOut } from "@/server/auth/auth";
import { apiServer } from "@/server/trpc/setup/server";
import { cookies, headers } from "next/headers";

export async function oAuthSignInAction({
  providerId,
  redirectPathname,
  email,
  password,
}: {
  providerId: string;
  redirectPathname?: string;
} & ({ email?: never; password?: never } | { email: string; password: string })) {
  if (email && password) {
    const cookieStore = await cookies();
    const emailBase64 = Buffer.from(email).toString("base64");
    const passwordBase64 = Buffer.from(password).toString("base64");
    const credentials = `${emailBase64}:${passwordBase64}`;

    cookieStore.set("unbind-credentials", credentials, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 1,
    });
  }

  const heads = await headers();
  const referer = heads.get("referer");
  let initiatingUrl: string;

  if (!referer) {
    return {
      error: {
        code: "NO_REFERER",
        message: "No referer header found.",
      },
    };
  }

  try {
    const url = new URL(referer);
    const origin = url.origin;
    const pathname = url.pathname;
    initiatingUrl = `${origin}${pathname}`;
  } catch (error) {
    console.log("Error parsing referer:", error);
    return {
      error: {
        code: "MALFORMED_REFERER",
        message: "Referer is malformed.",
      },
    };
  }

  await signIn(
    providerId,
    {
      redirectTo: redirectPathname ?? "/",
    },
    {
      initiating_url: initiatingUrl,
    },
  );
}

export async function createFirstAccountAction({
  providerId,
  redirectPathname,
  email,
  password,
}: {
  providerId: string;
  redirectPathname?: string;
  email: string;
  password: string;
}) {
  const heads = await headers();
  const referer = heads.get("referer");

  if (!referer) {
    return {
      error: {
        code: "NO_REFERER",
        message: "No referer header found.",
      },
    };
  }

  const cookieStore = await cookies();
  const emailBase64 = Buffer.from(email).toString("base64");
  const passwordBase64 = Buffer.from(password).toString("base64");
  const credentials = `${emailBase64}:${passwordBase64}`;

  cookieStore.set("unbind-credentials", credentials, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 1,
  });

  try {
    const result = await apiServer.setup.status();
    const isFirstUserCreated = result.data.is_first_user_created;

    if (!isFirstUserCreated) {
      const { error } = await apiServer.setup.createUser({
        email,
        password,
      });

      if (error) {
        return {
          error,
        };
      }
    }
  } catch (error) {
    console.log("Error creating user:", error);
    return {
      error: {
        code: "USER_CREATION_FAILED",
        message: "Failed to create user.",
      },
    };
  }

  await signIn(
    providerId,
    {
      redirectTo: redirectPathname ?? "/",
    },
    {
      initiating_url: referer,
    },
  );
}

export async function signOutAction() {
  await signOut({
    redirect: true,
    redirectTo: "/sign-in",
  });
}
