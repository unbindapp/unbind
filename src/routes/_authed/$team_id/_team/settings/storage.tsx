import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import S3SourcesProvider from "@/components/storage/s3-sources-provider";
import StorageTabContent from "@/components/storage/storage-tab-content";

export const Route = createFileRoute("/_authed/$team_id/_team/settings/storage")({
  component: TeamStorageSettings,
});

function TeamStorageSettings() {
  const { team_id: teamId } = Route.useParams();
  return (
    <S3SourcesProvider teamId={teamId}>
      <SettingsTabTitle>Storage</SettingsTabTitle>
      <StorageTabContent className="mt-2" />
    </S3SourcesProvider>
  );
}
