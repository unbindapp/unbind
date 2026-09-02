import { createFileRoute } from "@tanstack/react-router";

import { s3BucketsListQuery } from "@/lib/queries/storage";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import S3BucketsProvider from "@/components/storage/s3-buckets-provider";
import StorageTabContent from "@/components/storage/storage-tab-content";

export const Route = createFileRoute("/$team_id/_team/settings/storage/")({
  // Runs on intent preload (hover) so hovering the tab warms the cache
  // before navigation. Non-blocking; the provider shows skeletons meanwhile.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(s3BucketsListQuery({ teamId: params.team_id }));
  },
  component: TeamStorageSettings,
});

function TeamStorageSettings() {
  const { team_id: teamId } = Route.useParams();
  return (
    <S3BucketsProvider teamId={teamId}>
      <SettingsTabTitle>Storage</SettingsTabTitle>
      <StorageTabContent className="mt-2" />
    </S3BucketsProvider>
  );
}
