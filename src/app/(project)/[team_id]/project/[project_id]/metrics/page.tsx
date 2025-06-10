import EnvironmentSelector from "@/app/(project)/[team_id]/project/[project_id]/_components/environment-selector";
import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import Charts from "@/app/(project)/[team_id]/project/[project_id]/metrics/_components/charts";
import MetricsIntervalDropdown from "@/components/metrics/metrics-interval-dropdown";
import MetricsProvider from "@/components/metrics/metrics-provider";
import MetricsStateProvider from "@/components/metrics/metrics-state-provider";
import { metricsSearchParams } from "@/components/metrics/search-params";
import PageWrapper from "@/components/page-wrapper";
import ServicesProvider from "@/components/service/services-provider";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  const [{ teamId, projectId, environmentId }] = await Promise.all([
    getProjectPageParams({
      searchParams,
      params,
      currentPathname: `/metrics`,
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
                <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
                  <h1 className="min-w-0 pr-1.5 pl-2 text-2xl leading-tight font-bold">Metrics</h1>
                  <EnvironmentSelector />
                </div>
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
