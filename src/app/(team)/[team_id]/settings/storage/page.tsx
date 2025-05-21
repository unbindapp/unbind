import StorageTabContent from "@/app/(team)/[team_id]/settings/storage/_components/storage-tab-content";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import S3SourcesProvider from "@/components/storage/s3-sources-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";

type TProps = {
  params: Promise<{ team_id: string }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId } = await params;

  const initialData = await ResultAsync.fromPromise(
    apiServer.storage.s3.list({
      teamId,
    }),
    () => new Error("Failed to fetch services"),
  );

  return (
    <S3SourcesProvider
      teamId={teamId}
      initialData={initialData.isOk() ? initialData.value : undefined}
    >
      <SettingsTabTitle>Storage</SettingsTabTitle>
      <StorageTabContent className="mt-2" />
    </S3SourcesProvider>
  );
}
