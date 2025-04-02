import { getProjectPageSearchParams } from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import Charts from "@/app/(project)/[team_id]/project/[project_id]/metrics/_components/charts";
import MetricsProvider from "@/components/metrics/metrics-provider";
import PageWrapper from "@/components/page-wrapper";
import { SearchParams } from "nuqs";

type TProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

export default async function Page({ params, searchParams }: TProps) {
  const { team_id: teamId, project_id: projectId } = await params;
  const { environmentId } = await getProjectPageSearchParams({
    teamId,
    projectId,
    searchParams,
    currentPathname: `/${teamId}/project/${projectId}/metrics`,
  });

  return (
    <PageWrapper>
      <div className="flex w-full max-w-7xl flex-col">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
          <h1 className="w-full px-2 text-2xl leading-tight font-bold">Metrics</h1>
        </div>
        <div className="flex w-full flex-row flex-wrap pt-3">
          <MetricsProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            type="environment"
          >
            <Charts />
          </MetricsProvider>
        </div>
      </div>
    </PageWrapper>
  );
}
