import { createFileRoute } from "@tanstack/react-router";

import { projectsListQuery } from "@/lib/queries/projects";
import PageWrapper from "@/components/page-wrapper";
import ProjectsProvider from "@/components/project/projects-provider";
import NewProjectButton from "@/components/team/new-project-button";
import ProjectCardList from "@/components/team/project-card-list";

export const Route = createFileRoute("/$team_id/_team/")({
  loader: ({ context: { queryClient }, params }) => {
    // Warm the cache without blocking; ProjectCardList shows skeletons meanwhile.
    void queryClient.prefetchQuery(projectsListQuery({ teamId: params.team_id }));
  },
  component: TeamProjectsPage,
});

function TeamProjectsPage() {
  const { team_id: teamId } = Route.useParams();

  return (
    <ProjectsProvider teamId={teamId}>
      <PageWrapper>
        <div className="flex w-full max-w-7xl flex-col">
          <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
            <h1 className="min-w-0 px-2 text-2xl leading-tight font-semibold">Projects</h1>
            <NewProjectButton teamId={teamId} />
          </div>
          <div className="flex w-full items-center justify-center pt-3">
            <ProjectCardList teamId={teamId} />
          </div>
        </div>
      </PageWrapper>
    </ProjectsProvider>
  );
}
