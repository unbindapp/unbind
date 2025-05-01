"use server";

import { signIn, signOut } from "@/server/auth/auth";
import { cookies } from "next/headers";

export async function oAuthSignInAction({
  providerId,
  callbackUrl,
  email,
  password,
}: {
  providerId: string;
  callbackUrl?: string;
} & ({ email?: never; password?: never } | { email: string; password: string })) {
  if (email && password) {
    const cookieStore = await cookies();
    const emailBase64 = Buffer.from(email).toString("base64");
    const passwordBase64 = Buffer.from(password).toString("base64");
    const credentials = `${emailBase64}:${passwordBase64}`;
    cookieStore.set("unbind-credentials", credentials, {
      httpOnly: true,
      secure: true, // send only over HTTPS
      sameSite: "strict", // “non-lax” (sent only to the same site)
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });
  }
  await signIn(providerId, {
    redirectTo: callbackUrl ?? "",
  });
}

export async function signOutAction({ callbackUrl }: { callbackUrl?: string }) {
  await signOut({
    redirect: true,
    redirectTo: callbackUrl ?? "/",
  });
}
