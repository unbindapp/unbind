import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { teamsListQuery } from "@/lib/queries/teams";
import { getGoClient } from "@/lib/server/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meQuery } from "@/lib/queries/me";
import { Button } from "@/components/ui/button";
import { LoaderIcon, LogOutIcon } from "lucide-react";

// "/" resolves to the user's first team, mirroring the old server redirect.
export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const { teams } = await context.queryClient.ensureQueryData(teamsListQuery());
    const firstTeam = teams[0];
    if (firstTeam) {
      throw redirect({ to: "/$team_id", params: { team_id: firstTeam.id } });
    }
  },
  component: NoTeams,
});

function NoTeams() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate: signOut, isPending: isPendingSignOut } = useMutation({
    mutationFn: async () => await getGoClient().auth.logout(),
    onSuccess: () => {
      queryClient.setQueryData(meQuery.queryKey, null);
      router.history.push("/sign-in");
    },
  });
  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-4 px-4 py-8 text-center md:px-8">
      <div className="flex max-w-full flex-col gap-0.5">
        <h1 className="text-foreground text-2xl font-bold">No teams found</h1>
        <p className="text-muted-foreground">{`This account isn't a member of any team yet`}</p>
      </div>
      <Button
        disabled={isPendingSignOut}
        onClick={() => {
          signOut();
        }}
        className="max-w-full cursor-default items-center justify-start gap-2.5 rounded-lg text-left font-medium"
      >
        <div className="-my-1 -ml-0.5 size-5 shrink-0">
          {isPendingSignOut ? (
            <LoaderIcon className="size-full animate-spin" />
          ) : (
            <LogOutIcon className="size-full" />
          )}
        </div>
        <p className="min-w-0 shrink leading-tight">Sign Out</p>
      </Button>
    </main>
  );
}
