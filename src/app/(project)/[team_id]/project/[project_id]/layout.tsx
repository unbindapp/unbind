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
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  params: Promise<{ team_id: string; project_id: string }>;
};

export default async function Layout({ children, params }: TProps) {
  const { team_id: teamId, project_id: projectId } = await params;

  const [projectInitialData, projectsInitialData, templatesData, systemData] = await Promise.all([
    ResultAsync.fromPromise(
      apiServer.projects.get({
        teamId,
        projectId,
      }),
      () => new Error("Failed to fetch project"),
    ),
    ResultAsync.fromPromise(
      apiServer.projects.list({
        teamId,
      }),
      () => new Error("Failed to fetch projects"),
    ),
    ResultAsync.fromPromise(
      apiServer.templates.list(),
      () => new Error("Failed to fetch templates"),
    ),
    ResultAsync.fromPromise(apiServer.system.get(), () => new Error("Failed to fetch system")),
  ]);

  if (projectInitialData.isErr()) {
    throw new Error(projectInitialData.error.message);
  }

  if (projectsInitialData.isErr()) {
    throw new Error(projectsInitialData.error.message);
  }

  if (templatesData.isErr()) {
    throw new Error(templatesData.error.message);
  }

  if (systemData.isErr()) {
    throw new Error(systemData.error.message);
  }

  return (
    <SystemProvider initialData={systemData.value}>
      <TemplatesProvider data={templatesData.value}>
        <UpdateToastProvider>
          <ProjectsProvider initialData={projectsInitialData.value} teamId={teamId}>
            <ProjectProvider
              initialData={projectInitialData.value}
              teamId={teamId}
              projectId={projectId}
            >
              <DeploymentPanelIdProvider>
                <TemplateDraftPanelProvider>
                  <ServicePanelProvider>
                    <VolumePanelProvider>
                      <ProjectNavbar />
                      {children}
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
