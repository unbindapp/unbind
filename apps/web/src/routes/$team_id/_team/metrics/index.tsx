import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { metricsListQuery, MetricsIntervalEnum } from "@/lib/queries/metrics";
import { projectsListQuery } from "@/lib/queries/projects";
import MetricsIntervalDropdown from "@/components/metrics/metrics-interval-dropdown";
import MetricsProvider from "@/components/metrics/metrics-provider";
import MetricsStateProvider, {
  metricsIntervalEnumDefault,
} from "@/components/metrics/metrics-state-provider";
import TeamCharts from "@/components/metrics/team-charts";
import PageWrapper from "@/components/page-wrapper";
import ProjectsProvider from "@/components/project/projects-provider";

const searchSchema = z.object({ metrics_interval: MetricsIntervalEnum.optional() });

export const Route = createFileRoute("/$team_id/_team/metrics/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({
    interval: search.metrics_interval ?? metricsIntervalEnumDefault,
  }),
  loader: ({ context: { queryClient }, params, deps }) => {
    // Non-blocking; the providers below render immediately and show skeletons.
    void queryClient.prefetchQuery(projectsListQuery({ teamId: params.team_id }));
    void queryClient.prefetchQuery(
      metricsListQuery({ type: "team", teamId: params.team_id, interval: deps.interval }),
    );
  },
  component: TeamMetricsPage,
});

function TeamMetricsPage() {
  const { team_id: teamId } = Route.useParams();

  return (
    <PageWrapper>
      <ProjectsProvider teamId={teamId}>
        <MetricsStateProvider>
          <MetricsProvider teamId={teamId} type="team">
            <div className="flex w-full max-w-7xl flex-col">
              <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
                <h1 className="min-w-0 px-2 text-2xl leading-tight font-semibold">Metrics</h1>
                <MetricsIntervalDropdown className="-my-2" />
              </div>
              <div className="flex w-full flex-row flex-wrap pt-3">
                <TeamCharts />
              </div>
            </div>
          </MetricsProvider>
        </MetricsStateProvider>
      </ProjectsProvider>
    </PageWrapper>
  );
}
