import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, Outlet, useMatch } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import {
  deploymentPanelDeploymentIdKey,
  deploymentPanelTabKey,
  DeploymentPanelTabEnum,
} from "@/components/deployment/panel/constants";
import { metricsIntervalSearchParamKey } from "@/components/metrics/metrics-state-provider";
import {
  servicePanelServiceIdKey,
  servicePanelTabKey,
  ServicePanelTabEnum,
} from "@/components/service/panel/constants";
import { templateDraftPanelTemplateDraftIdKey } from "@/components/templates/panel/constants";
import {
  volumePanelTabKey,
  VolumePanelTabEnum,
  volumePanelVolumeIdKey,
} from "@/components/volume/panel/constants";
import { MetricsIntervalEnum } from "@/lib/queries/metrics";
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
import { UpdateToastProvider } from "@/components/update/update-status-provider";
import VolumePanelProvider from "@/components/volume/panel/volume-panel-provider";

// All search params owned by the project area live here — every panel/logs/metrics
// consumer is mounted within this route's subtree, so this is their common ancestor.
const searchSchema = z.object({
  environment: z.string().optional(),
  // Service panel
  [servicePanelServiceIdKey]: z.string().optional(),
  [servicePanelTabKey]: ServicePanelTabEnum.optional(),
  // Volume panel
  [volumePanelVolumeIdKey]: z.string().optional(),
  [volumePanelTabKey]: VolumePanelTabEnum.optional(),
  // Deployment panel
  [deploymentPanelDeploymentIdKey]: z.string().optional(),
  [deploymentPanelTabKey]: DeploymentPanelTabEnum.optional(),
  // Template draft panel
  [templateDraftPanelTemplateDraftIdKey]: z.string().optional(),
  // Metrics
  [metricsIntervalSearchParamKey]: MetricsIntervalEnum.optional(),
  // Logs (one namespace per log scope, see log-filters-provider)
  q: z.string().optional(),
  levels: z.string().optional(),
  services: z.string().optional(),
  range: z.string().optional(),
  highlight_log: z.string().optional(),
  sq: z.string().optional(),
  slevels: z.string().optional(),
  sservices: z.string().optional(),
  srange: z.string().optional(),
  shighlight_log: z.string().optional(),
  dq: z.string().optional(),
  dlevels: z.string().optional(),
  dservices: z.string().optional(),
  drange: z.string().optional(),
  dhighlight_log: z.string().optional(),
  bq: z.string().optional(),
  blevels: z.string().optional(),
  bservices: z.string().optional(),
  brange: z.string().optional(),
  bhighlight_log: z.string().optional(),
});

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

  // The log viewer sizes itself to the viewport and scrolls internally, so the
  // clearance the other pages need under the fixed phone navbar would only add a
  // second scrollbar there.
  const isLogsPage = Boolean(
    useMatch({
      from: "/$team_id/project/$project_id/logs/",
      shouldThrow: false,
      select: () => true,
    }),
  );

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
            // Preserve the rest of the search (open panels etc.) — replacing it
            // wholesale would close any deep-linked service/deployment panel.
            search={(prev) => ({ ...prev, environment: fallback })}
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
                      {!isLogsPage && <NavbarSafeAreaInsetBottom className="sm:hidden" />}
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
