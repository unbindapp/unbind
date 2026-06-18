import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { getGoClient } from "@/server/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "../../components/auth-shell";
import { meQuery } from "@/lib/queries/me";

export const Route = createFileRoute("/sign-out/")({
  component: SignOut,
});

function SignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function onSignOut() {
    setIsPending(true);
    try {
      await getGoClient().auth.logout();
    } catch {
      // TO-DO
      // Clear local session regardless of the network result.
    }
    queryClient.setQueryData(meQuery.queryKey, null);
    router.history.push("/sign-in");
  }

  return (
    <AuthShell subtitle="Sign out">
      <Button className="mt-5 w-full max-w-xs" onClick={onSignOut} isPending={isPending}>
        Sign Out
      </Button>
    </AuthShell>
  );
}
