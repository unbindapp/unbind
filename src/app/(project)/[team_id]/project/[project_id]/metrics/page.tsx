import { getProjectPageSearchParams } from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import Charts from "@/app/(project)/[team_id]/project/[project_id]/metrics/_components/charts";
import MetricsIntervalDropdown from "@/components/metrics/metrics-interval-dropdown";
import MetricsProvider from "@/components/metrics/metrics-provider";
import MetricsStateProvider from "@/components/metrics/metrics-state-provider";
import { metricsSearchParams } from "@/components/metrics/search-params";
import PageWrapper from "@/components/page-wrapper";
import ServicesProvider from "@/components/project/services-provider";
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
  const [{ environmentId }] = await Promise.all([
    getProjectPageSearchParams({
      teamId,
      projectId,
      searchParams,
      currentPathname: `/${teamId}/project/${projectId}/metrics`,
    }),
    metricsSearchParams.parse(searchParams),
  ]);

  return (
    <PageWrapper>
      <ServicesProvider teamId={teamId} projectId={projectId} environmentId={environmentId}>
        <MetricsStateProvider>
          <MetricsProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            type="environment"
          >
            <div className="flex w-full max-w-7xl flex-col">
              <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
                <h1 className="min-w-0 shrink px-2 text-2xl leading-tight font-bold">Metrics</h1>
                <MetricsIntervalDropdown className="-my-2" />
              </div>
              <div className="flex w-full flex-row flex-wrap pt-3">
                <Charts />
              </div>
            </div>
          </MetricsProvider>
        </MetricsStateProvider>
      </ServicesProvider>
    </PageWrapper>
  );
}
