import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { projectQuery, projectsListQuery } from "@/api/services/projects";
import { systemQuery } from "@/api/services/system";
import { templatesListQuery } from "@/api/services/templates";
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

export const Route = createFileRoute("/_authed/$team_id/project/$project_id")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ environment: search.environment }),
  loader: async ({ context: { queryClient }, params, deps }) => {
    const [{ project }] = await Promise.all([
      queryClient.ensureQueryData(projectQuery(params.team_id, params.project_id)),
      queryClient.ensureQueryData(projectsListQuery(params.team_id)),
      queryClient.ensureQueryData(templatesListQuery()),
      queryClient.ensureQueryData(systemQuery()),
    ]);

    // Resolve a valid environment into the URL for the whole project area.
    const environments = project.environments;
    const isValid = deps.environment && environments.some((e) => e.id === deps.environment);
    if (!isValid) {
      const fallback = project.default_environment_id ?? environments[0]?.id;
      if (fallback && fallback !== deps.environment) {
        throw redirect({
          to: "/$team_id/project/$project_id",
          params,
          search: { environment: fallback },
        });
      }
    }
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  const { data: templatesData } = useSuspenseQuery(templatesListQuery());
  const { data: systemData } = useSuspenseQuery(systemQuery());

  return (
    <SystemProvider initialData={systemData}>
      <TemplatesProvider data={templatesData}>
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
