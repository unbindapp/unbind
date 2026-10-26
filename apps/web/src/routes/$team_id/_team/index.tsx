import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { projectsListQuery } from "@/lib/queries/projects";
import { searchSortSearchSchema, useSearchSortParams } from "@/lib/hooks/use-search-sort-params";
import PageWrapper from "@/components/page-wrapper";
import ProjectsProvider from "@/components/project/projects-provider";
import SearchSortToolbar from "@/components/search-sort-toolbar";
import NewProjectButton from "@/components/team/new-project-button";
import ProjectCardList from "@/components/team/project-card-list";

export const Route = createFileRoute("/$team_id/_team/")({
  validateSearch: zodValidator(z.object(searchSortSearchSchema)),
  loader: ({ context: { queryClient }, params }) => {
    // Warm the cache without blocking; ProjectCardList shows skeletons meanwhile.
    void queryClient.prefetchQuery(projectsListQuery({ teamId: params.team_id }));
  },
  component: TeamProjectsPage,
});

function TeamProjectsPage() {
  const { team_id: teamId } = Route.useParams();
  const { search, setSearch, sort, setSort } = useSearchSortParams();

  return (
    <ProjectsProvider teamId={teamId}>
      <PageWrapper>
        <div className="flex w-full max-w-7xl flex-col">
          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-5 px-1">
            <h1 className="mr-auto min-w-0 px-2 text-2xl leading-tight font-semibold">Projects</h1>
            <SearchSortToolbar
              searchPlaceholder="Search projects"
              sortLabel="Sort projects"
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              className="order-last -mt-2 w-full lg:order-none lg:-my-2 lg:w-60"
            />
            <NewProjectButton teamId={teamId} />
          </div>
          <div className="flex w-full items-center justify-center pt-3">
            <ProjectCardList
              teamId={teamId}
              search={search}
              sort={sort}
              onClearSearch={() => setSearch("")}
            />
          </div>
        </div>
      </PageWrapper>
    </ProjectsProvider>
  );
}
