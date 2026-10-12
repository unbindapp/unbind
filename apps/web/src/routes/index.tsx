import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";

import { getLastTeamId } from "@/lib/last-team";
import { teamsListQuery } from "@/lib/queries/teams";
import { getGoClient } from "@/lib/server/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isSystemAdmin, meQuery } from "@/lib/queries/me";
import { Button } from "@/components/ui/button";
import { CreateTeamDialog } from "@/components/team/create-team-dialog";
import { LoaderIcon, LogOutIcon, PlusIcon } from "lucide-react";

// "/" resolves to the team the user was last on, else their first team.
export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const { teams } = await context.queryClient.ensureQueryData(teamsListQuery());
    const lastTeamId = getLastTeamId();
    const team = teams.find((t) => t.id === lastTeamId) ?? teams[0];
    if (team) {
      throw redirect({ to: "/$team_id", params: { team_id: team.id } });
    }
  },
  component: NoTeams,
});

function NoTeams() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: me } = useQuery(meQuery);
  const canCreateTeam = isSystemAdmin(me);
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
        <h1 className="text-foreground text-2xl font-semibold">No teams found</h1>
        <p className="text-muted-foreground">
          {canCreateTeam
            ? "There are no teams yet. Create the first one."
            : `This account isn't a member of any team yet`}
        </p>
      </div>
      {canCreateTeam && (
        <CreateTeamDialog>
          <Button className="max-w-full cursor-default items-center justify-start gap-2.5 rounded-lg text-left font-medium">
            <PlusIcon className="-my-1 -ml-0.5 size-5 shrink-0" />
            <p className="min-w-0 shrink leading-tight">Create Team</p>
          </Button>
        </CreateTeamDialog>
      )}
      <Button
        variant={canCreateTeam ? "outline" : "default"}
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
