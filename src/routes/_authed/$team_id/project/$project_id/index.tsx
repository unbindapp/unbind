import { createFileRoute, useSearch } from "@tanstack/react-router";

import { servicesListQuery } from "@/api/services/services";
import EnvironmentSelector from "@/components/environment/environment-selector";
import PageWrapper from "@/components/page-wrapper";
import NewServiceButton from "@/components/project/new-service-button";
import ServiceCardList from "@/components/service/service-card-list";
import ServicesProvider from "@/components/service/services-provider";

const projectRouteId = "/_authed/$team_id/project/$project_id";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/")({
  // Expose the environment search param to the loader so it can key the query.
  loaderDeps: ({ search: { environment } }) => ({ environment }),
  loader: ({ context: { queryClient }, params, deps }) => {
    // Runs on intent preload (hover) too, so hovering a project card on the
    // team page warms the services cache before navigation. Non-blocking;
    // ServiceCardList shows skeletons meanwhile. Skip until the environment is
    // resolved into the URL (matches ServicesProvider's `enabled` guard).
    if (!deps.environment) return;
    void queryClient.prefetchQuery(
      servicesListQuery(params.team_id, params.project_id, deps.environment),
    );
  },
  component: ProjectServicesPage,
});

function ProjectServicesPage() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const { environment } = useSearch({ from: projectRouteId });

  return (
    <ServicesProvider teamId={teamId} projectId={projectId} environmentId={environment ?? ""}>
      <PageWrapper>
        <div className="flex w-full max-w-7xl flex-col">
          <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2">
              <h1 className="min-w-0 pr-1.5 pl-2 text-2xl leading-tight font-bold">Services</h1>
              <EnvironmentSelector />
            </div>
            <NewServiceButton className="-my-2" />
          </div>
          <div className="flex w-full items-center justify-center pt-3">
            <ServiceCardList />
          </div>
        </div>
      </PageWrapper>
    </ServicesProvider>
  );
}
