import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { useRememberTeam } from "@/lib/last-team";
import { isSystemViewer, meQuery } from "@/lib/queries/me";
import { systemQuery } from "@/lib/queries/system";
import { teamQuery, teamsListQuery } from "@/lib/queries/teams";
import { templatesListQuery } from "@/lib/queries/templates";
import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import SystemProvider from "@/components/system/system-provider";
import TeamGuard from "@/components/team/team-guard";
import TeamNavbar from "@/components/team/team-navbar";
import TeamProvider from "@/components/team/team-provider";
import TeamsProvider from "@/components/team/teams-provider";
import TemplatesProvider from "@/components/templates/templates-provider";
import RegistryWarningToastProvider from "@/components/system/registry/registry-warning-toast-provider";
import { UpdateToastProvider } from "@/components/system/update/update-status-provider";

export const Route = createFileRoute("/$team_id/_team")({
  loader: ({ context: { queryClient }, params }) => {
    // Warm the cache (this also runs on intent preload) without blocking the
    // navigation. The components below render immediately and show skeletons.
    void queryClient.prefetchQuery(teamsListQuery());
    if (isSystemViewer(queryClient.getQueryData(meQuery.queryKey))) {
      void queryClient.prefetchQuery(systemQuery());
    }
    void queryClient.prefetchQuery(templatesListQuery());
    void queryClient.prefetchQuery(teamQuery({ teamId: params.team_id }));
  },
  component: TeamLayout,
});

function TeamLayout() {
  const { team_id: teamId } = Route.useParams();
  const { data: teamsData } = useQuery(teamsListQuery());
  useRememberTeam(teamId);

  return (
    <TeamGuard teamId={teamId}>
      <SystemProvider>
        <TemplatesProvider>
          <UpdateToastProvider>
            <RegistryWarningToastProvider>
              <TeamsProvider initialData={teamsData}>
                <TeamProvider teamId={teamId}>
                  <TeamNavbar />
                  <Outlet />
                  <NavbarSafeAreaInsetBottom className="sm:hidden" />
                  <ContextCommandPanel
                    title="Team Command Panel"
                    description="Team command panel"
                    context={{ contextType: "team", teamId }}
                    triggerType="layout"
                  />
                </TeamProvider>
              </TeamsProvider>
            </RegistryWarningToastProvider>
          </UpdateToastProvider>
        </TemplatesProvider>
      </SystemProvider>
    </TeamGuard>
  );
}
