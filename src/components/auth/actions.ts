"use server";

import { signIn, signOut } from "@/server/auth/auth";

export async function oAuthSignInAction({
  providerId,
  callbackUrl,
}: {
  providerId: string;
  callbackUrl?: string;
}) {
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
