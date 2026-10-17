import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { projectsListQuery } from "@/lib/queries/projects";
import PageWrapper from "@/components/page-wrapper";
import ProjectsProvider from "@/components/project/projects-provider";
import NewProjectButton from "@/components/team/new-project-button";
import ProjectCardList from "@/components/team/project-card-list";
import ProjectsToolbar from "@/components/team/projects-toolbar";
import { defaultProjectSort, ProjectSortEnum, type TProjectSort } from "@/lib/project-sort";
import { useState } from "react";

const searchSchema = z.object({
  search: z.string().optional(),
  sort: ProjectSortEnum.optional().catch(undefined),
});

export const Route = createFileRoute("/$team_id/_team/")({
  validateSearch: zodValidator(searchSchema),
  loader: ({ context: { queryClient }, params }) => {
    // Warm the cache without blocking; ProjectCardList shows skeletons meanwhile.
    void queryClient.prefetchQuery(projectsListQuery({ teamId: params.team_id }));
  },
  component: TeamProjectsPage,
});

function TeamProjectsPage() {
  const { team_id: teamId } = Route.useParams();
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [search, setSearchState] = useState(params.search ?? "");
  const sort = params.sort ?? defaultProjectSort;

  const setParams = (patch: z.infer<typeof searchSchema>) =>
    navigate({
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
      resetScroll: false,
    });

  const setSearch = (value: string) => {
    setSearchState(value);
    setParams({ search: value || undefined });
  };

  const setSort = (value: TProjectSort) =>
    setParams({ sort: value === defaultProjectSort ? undefined : value });

  return (
    <ProjectsProvider teamId={teamId}>
      <PageWrapper>
        <div className="flex w-full max-w-7xl flex-col">
          <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-5 px-1">
            <h1 className="mr-auto min-w-0 px-2 text-2xl leading-tight font-semibold">Projects</h1>
            <ProjectsToolbar
              search={search}
              onSearchChange={setSearch}
              sort={sort}
              onSortChange={setSort}
              className="order-last w-full lg:order-none lg:-my-2 lg:w-72"
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
