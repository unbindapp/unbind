import { createFileRoute } from "@tanstack/react-router";

import GithubAppsList from "@/components/git/github-apps-list";
import GithubAppsProvider from "@/components/git/github-apps-provider";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import { gitAppsQuery } from "@/lib/queries/git";
import { teamsListQuery } from "@/lib/queries/teams";

export const Route = createFileRoute("/account/settings/github/")({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(gitAppsQuery({ owned: true }));
    void queryClient.prefetchQuery(teamsListQuery());
  },
  component: AccountGithubSettings,
});

function AccountGithubSettings() {
  return (
    <GithubAppsProvider filter={{ owned: true }}>
      <SettingsTabTitle>GitHub</SettingsTabTitle>
      <p className="text-muted-foreground mt-0.5 w-full px-1">
        GitHub accounts you connected. Share one with a team so its members can deploy from it.
      </p>
      <GithubAppsList view="account" className="mt-3" />
    </GithubAppsProvider>
  );
}
