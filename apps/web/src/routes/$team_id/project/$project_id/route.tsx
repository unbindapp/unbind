import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { projectQuery, projectsListQuery } from "@/lib/queries/projects";
import { systemQuery } from "@/lib/queries/system";
import { templatesListQuery } from "@/lib/queries/templates";
import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import DeploymentPanelIdProvider from "@/components/deployment/panel/deployment-panel-id-provider";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import ProjectNavbar from "@/components/project/project-navbar";
import ProjectProvider from "@/components/project/project-provider";
import ProjectsProvider from "@/components/project/projects-provider";
import ServicePanelProvider from "@/components/service/panel/service-panel-provider";
import SystemProvider from "@/components/system/system-provider";
import TemplateDraftPanelProvider from "@/components/templates/panel/template-draft-panel-provider";
import TemplatesProvider from "@/components/templates/templates-provider";
import { UpdateToastProvider } from "@/components/update/check-for-updates-provider";
import VolumePanelProvider from "@/components/volume/panel/volume-panel-provider";

const searchSchema = z.object({ environment: z.string().optional() });

export const Route = createFileRoute("/$team_id/project/$project_id")({
  validateSearch: zodValidator(searchSchema),
  loader: ({ context: { queryClient }, params }) => {
    // Warm the cache (this also runs on intent preload) without blocking the
    // navigation — the components below render immediately and show skeletons.
    void queryClient.prefetchQuery(
      projectQuery({ teamId: params.team_id, projectId: params.project_id }),
    );
    void queryClient.prefetchQuery(projectsListQuery({ teamId: params.team_id }));
    void queryClient.prefetchQuery(templatesListQuery());
    void queryClient.prefetchQuery(systemQuery());
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const { environment } = Route.useSearch();
  const { data: projectData } = useQuery(projectQuery({ teamId, projectId }));

  // Resolve a valid environment into the URL for the whole project area. Moved
  // out of the loader so navigation isn't blocked on the project query.
  if (projectData) {
    const environments = projectData.project.environments;
    const isValid = environment && environments.some((e) => e.id === environment);
    if (!isValid) {
      const fallback = projectData.project.default_environment_id ?? environments[0]?.id;
      if (fallback && fallback !== environment) {
        return (
          <Navigate
            to="/$team_id/project/$project_id"
            params={{ team_id: teamId, project_id: projectId }}
            search={{ environment: fallback }}
            replace
          />
        );
      }
    }
  }

  return (
    <SystemProvider>
      <TemplatesProvider>
        <UpdateToastProvider>
          <ProjectsProvider teamId={teamId}>
            <ProjectProvider teamId={teamId} projectId={projectId}>
              <DeploymentPanelIdProvider>
                <TemplateDraftPanelProvider>
                  <ServicePanelProvider>
                    <VolumePanelProvider>
                      <ProjectNavbar />
                      <Outlet />
                      <NavbarSafeAreaInsetBottom className="sm:hidden" />
                      <ContextCommandPanel
                        title="Project Command Panel"
                        description="Project command panel"
                        triggerType="layout"
                        context={{
                          contextType: "project",
                          projectId,
                          teamId,
                        }}
                      />
                    </VolumePanelProvider>
                  </ServicePanelProvider>
                </TemplateDraftPanelProvider>
              </DeploymentPanelIdProvider>
            </ProjectProvider>
          </ProjectsProvider>
        </UpdateToastProvider>
      </TemplatesProvider>
    </SystemProvider>
  );
}
