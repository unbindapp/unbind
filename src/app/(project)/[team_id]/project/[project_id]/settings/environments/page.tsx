import EnvironmentsTabContent from "@/app/(project)/[team_id]/project/[project_id]/settings/environments/_components/environments-tab-content";
import EnvironmentsProvider from "@/components/environment/environments-provider";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { notFound } from "next/navigation";

type TProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
  }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId, project_id: projectId } = await params;

  const initialData = await ResultAsync.fromPromise(
    apiServer.environments.list({
      teamId,
      projectId,
    }),
    () => new Error("Failed to fetch services"),
  );

  if (initialData.isErr()) {
    return notFound();
  }

  return (
    <EnvironmentsProvider teamId={teamId} projectId={projectId} initialData={initialData.value}>
      <SettingsTabTitle>Environments</SettingsTabTitle>
      <EnvironmentsTabContent />
    </EnvironmentsProvider>
  );
}
