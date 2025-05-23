import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import EnvironmentsTabContent from "@/app/(project)/[team_id]/project/[project_id]/settings/environments/_components/environments-tab-content";
import EnvironmentsProvider from "@/components/environment/environments-provider";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  const { teamId, projectId } = await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings/environments`,
  });

  const initialData = await ResultAsync.fromPromise(
    apiServer.environments.list({
      teamId,
      projectId,
    }),
    () => new Error("Failed to fetch services"),
  );

  return (
    <EnvironmentsProvider
      teamId={teamId}
      projectId={projectId}
      initialData={initialData.isOk() ? initialData.value : undefined}
    >
      <SettingsTabTitle>Environments</SettingsTabTitle>
      <EnvironmentsTabContent />
    </EnvironmentsProvider>
  );
}
