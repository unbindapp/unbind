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

  if (!referer) {
    return {
      error: {
        code: "NO_REFERER",
        message: "No referer header found.",
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

  try {
    const { error } = await apiServer.setup.createUser({
      email,
      password,
    });

    if (error) {
      return {
        error,
      };
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

  cookieStore.set("unbind-credentials", credentials, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 1,
  });

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

export async function signOutAction({ redirectPathname }: { redirectPathname?: string }) {
  await signOut({
    redirect: true,
    redirectTo: redirectPathname ?? "/",
  });
}
