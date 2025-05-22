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
import CheckForUpdatesProvider, {
  UpdateToastProvider,
} from "@/components/update/check-for-updates-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { redirect } from "next/navigation";
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
    return redirect(`/${teamId}`);
  }

  if (projectsInitialData.isErr()) {
    return redirect(`/${teamId}`);
  }

  if (templatesData.isErr()) {
    return redirect(`/${teamId}`);
  }

  if (systemData.isErr()) {
    return redirect(`/${teamId}`);
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
