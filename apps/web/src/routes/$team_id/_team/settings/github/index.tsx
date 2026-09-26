import { createFileRoute } from "@tanstack/react-router";

import { ConnectGithubCard } from "@/components/git/connect-github-dialog";
import GithubAppsList from "@/components/git/github-apps-list";
import GithubAppsProvider from "@/components/git/github-apps-provider";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import { useTeam } from "@/components/team/team-provider";
import { gitAppsQuery } from "@/lib/queries/git";

export const Route = createFileRoute("/$team_id/_team/settings/github/")({
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(gitAppsQuery({ teamId: params.team_id }));
  },
  component: TeamGithubSettings,
});

function TeamGithubSettings() {
  const { team_id: teamId } = Route.useParams();
  const {
    query: { data: teamData },
  } = useTeam();
  const canEditTeam = teamData?.team.permissions.includes("editor") ?? false;
  const team = teamData ? { id: teamData.team.id, name: teamData.team.name } : undefined;
  return (
    <GithubAppsProvider filter={{ teamId }}>
      <SettingsTabTitle>GitHub Apps</SettingsTabTitle>
      <p className="text-muted-foreground mt-0.5 w-full px-1">
        GitHub Apps shared with this team. Members can deploy from their repositories.
      </p>
      <GithubAppsList view="team" canEditTeam={canEditTeam} className="mt-3">
        <ConnectGithubCard sharing={{ mode: "team", team }} />
      </GithubAppsList>
    </GithubAppsProvider>
  );
}
