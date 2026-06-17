import { createFileRoute } from "@tanstack/react-router";

import { s3SourcesListQuery } from "@/api/queries/storage";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import S3SourcesProvider from "@/components/storage/s3-sources-provider";
import StorageTabContent from "@/components/storage/storage-tab-content";

export const Route = createFileRoute("/$team_id/_team/settings/storage/")({
  // Runs on intent preload (hover) so hovering the tab warms the cache
  // before navigation. Non-blocking; the provider shows skeletons meanwhile.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(s3SourcesListQuery(params.team_id));
  },
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
