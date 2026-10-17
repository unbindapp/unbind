import { createFileRoute, useSearch } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { servicesListQuery } from "@/lib/queries/services";
import { searchSortSearchSchema, useSearchSortParams } from "@/lib/hooks/use-search-sort-params";
import EnvironmentSelector from "@/components/environment/environment-selector";
import PageWrapper from "@/components/page-wrapper";
import NewServiceButton from "@/components/project/new-service-button";
import SearchSortToolbar from "@/components/search-sort-toolbar";
import ServiceCardList from "@/components/service/service-card-list";
import ServicesProvider from "@/components/service/services-provider";
import VolumesProvider from "@/components/volume/volumes-provider";
import VolumesSection from "@/components/volume/volumes-section";

const projectRouteId = "/$team_id/project/$project_id";

export const Route = createFileRoute("/$team_id/project/$project_id/")({
  validateSearch: zodValidator(z.object(searchSortSearchSchema)),
  // Expose the environment search param to the loader so it can key the query.
  loaderDeps: ({ search: { environment } }) => ({ environment }),
  loader: ({ context: { queryClient }, params, deps }) => {
    // Runs on intent preload (hover) too, so hovering a project card on the
    // team page warms the services cache before navigation. Non-blocking;
    // ServiceCardList shows skeletons meanwhile. Skip until the environment is
    // resolved into the URL (matches ServicesProvider's `enabled` guard).
    if (!deps.environment) return;
    void queryClient.prefetchQuery(
      servicesListQuery({
        teamId: params.team_id,
        projectId: params.project_id,
        environmentId: deps.environment,
      }),
    );
  },
  component: ProjectServicesPage,
});

function ProjectServicesPage() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const { environment } = useSearch({ from: projectRouteId });
  const { search, setSearch, sort, setSort } = useSearchSortParams();

  return (
    <ServicesProvider teamId={teamId} projectId={projectId} environmentId={environment ?? ""}>
      <VolumesProvider teamId={teamId} projectId={projectId} environmentId={environment ?? ""}>
        <PageWrapper>
          <div className="flex w-full max-w-7xl flex-col">
            <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-5 px-1">
              <div className="mr-auto flex min-w-0 flex-wrap items-center justify-start gap-2">
                <h1 className="min-w-0 pr-1.5 pl-2 text-2xl leading-tight font-semibold">
                  Services
                </h1>
                <EnvironmentSelector />
              </div>
              <SearchSortToolbar
                searchPlaceholder="Search services"
                sortLabel="Sort services"
                search={search}
                onSearchChange={setSearch}
                sort={sort}
                onSortChange={setSort}
                className="order-last w-full lg:order-none lg:-my-2 lg:w-68"
              />
              <NewServiceButton className="-my-2" />
            </div>
            <div className="flex w-full items-center justify-center pt-3">
              <ServiceCardList search={search} sort={sort} onClearSearch={() => setSearch("")} />
            </div>
            <VolumesSection />
          </div>
        </PageWrapper>
      </VolumesProvider>
    </ServicesProvider>
  );
}
