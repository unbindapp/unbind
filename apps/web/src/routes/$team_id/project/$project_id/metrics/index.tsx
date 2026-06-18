import { createFileRoute, useSearch } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { metricsListQuery } from "@/lib/queries/metrics";
import { servicesListQuery } from "@/lib/queries/services";
import Charts from "@/components/metrics/charts";
import MetricsIntervalDropdown from "@/components/metrics/metrics-interval-dropdown";
import MetricsProvider from "@/components/metrics/metrics-provider";
import MetricsStateProvider, {
  metricsIntervalEnumDefault,
} from "@/components/metrics/metrics-state-provider";
import EnvironmentSelector from "@/components/environment/environment-selector";
import PageWrapper from "@/components/page-wrapper";
import ServicesProvider from "@/components/service/services-provider";
import { MetricsIntervalEnum } from "@/server/types/metrics";

const projectRouteId = "/$team_id/project/$project_id";

const searchSchema = z.object({ metrics_interval: MetricsIntervalEnum.optional() });

export const Route = createFileRoute("/$team_id/project/$project_id/metrics/")({
  validateSearch: zodValidator(searchSchema),
  // Expose the params the queries are keyed by so the loader runs on intent
  // preload (hover) too. `environment` comes from the parent project route's
  // schema; `metrics_interval` from this route's schema (default 24h).
  loaderDeps: ({ search }) => ({
    environment: search.environment,
    interval: search.metrics_interval ?? metricsIntervalEnumDefault,
  }),
  loader: ({ context: { queryClient }, params, deps }) => {
    // Non-blocking; the providers below render immediately and show skeletons.
    // Skip until the environment is resolved into the URL, otherwise we'd warm
    // the cache under the wrong key (matches ServicesProvider's `enabled` guard).
    if (!deps.environment) return;
    void queryClient.prefetchQuery(
      servicesListQuery(params.team_id, params.project_id, deps.environment),
    );
    void queryClient.prefetchQuery(
      metricsListQuery({
        type: "environment",
        teamId: params.team_id,
        projectId: params.project_id,
        environmentId: deps.environment,
        interval: deps.interval,
      }),
    );
  },
  component: MetricsPage,
});

function MetricsPage() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const { environment } = useSearch({ from: projectRouteId });
  const environmentId = environment ?? "";

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
