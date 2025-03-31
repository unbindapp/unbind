import { getProjectPageSearchParams } from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import LogViewer from "@/components/logs/log-viewer";
import ServicesProvider from "@/components/project/services-provider";
import { auth } from "@/server/auth/auth";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { notFound } from "next/navigation";
import { SearchParams } from "nuqs";

type TProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

export default async function Page({ params, searchParams }: TProps) {
  const session = await auth();
  if (!session) return null;

  const { team_id: teamId, project_id: projectId } = await params;
  const searchParamsRes = await ResultAsync.fromPromise(
    getProjectPageSearchParams({
      teamId,
      projectId,
      searchParams,
      currentPathname: `/${teamId}/project/${projectId}`,
    }),
    () => new Error("Failed to get search params"),
  );

  if (searchParamsRes.isErr()) {
    return notFound();
  }

  const environmentId = searchParamsRes.value.environmentId;

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
