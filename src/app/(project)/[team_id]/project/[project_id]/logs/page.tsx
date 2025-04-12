import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import LogViewer from "@/components/logs/log-viewer";
import ServicesProvider from "@/components/project/services-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { notFound } from "next/navigation";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  const { teamId, projectId, environmentId } = await getProjectPageParams({
    searchParams,
    params,
    currentPathname: `/logs`,
  });

  const initialData = await ResultAsync.fromPromise(
    apiServer.services.list({
      teamId,
      projectId,
      environmentId,
    }),
    () => new Error("Failed to fetch services"),
  );

  if (initialData.isErr()) {
    return notFound();
  }

  return (
    <ServicesProvider
      initialData={initialData.value}
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
    >
      <LogViewer
        containerType="page"
        teamId={teamId}
        projectId={projectId}
        environmentId={environmentId}
        type="environment"
      />
    </ServicesProvider>
  );
}
