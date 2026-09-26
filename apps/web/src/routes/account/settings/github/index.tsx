import { createFileRoute } from "@tanstack/react-router";

import { ConnectGithubCard } from "@/components/git/connect-github-dialog";
import GithubAppsList from "@/components/git/github-apps-list";
import GithubAppsProvider from "@/components/git/github-apps-provider";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import { gitAppsQuery } from "@/lib/queries/git";
import { teamsListQuery } from "@/lib/queries/teams";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/account/settings/github/")({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(gitAppsQuery({ owned: true }));
    void queryClient.prefetchQuery(teamsListQuery());
  },
  component: AccountGithubSettings,
});

function AccountGithubSettings() {
  const { data: teamsData } = useQuery(teamsListQuery());
  const teams = teamsData?.teams
    .filter((team) => team.permissions.includes("editor"))
    .map((team) => ({ id: team.id, name: team.name }));
  return (
    <GithubAppsProvider filter={{ owned: true }}>
      <SettingsTabTitle>GitHub Apps</SettingsTabTitle>
      <p className="text-muted-foreground mt-0.5 w-full px-1">
        GitHub Apps you connected. Share one with a team so its members can deploy from it.
      </p>
      <GithubAppsList view="account" className="mt-3">
        <ConnectGithubCard teams={teams} />
      </GithubAppsList>
    </GithubAppsProvider>
  );
}
