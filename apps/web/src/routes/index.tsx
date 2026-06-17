import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { teamsListQuery } from "@/api/queries/teams";

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
  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-foreground text-2xl font-bold">No teams found</h1>
      <p className="text-muted-foreground">This account isn&apos;t a member of any team yet.</p>
      <Link to="/sign-out" className="text-primary font-medium underline-offset-4 hover:underline">
        Sign out
      </Link>
    </main>
  );
}
