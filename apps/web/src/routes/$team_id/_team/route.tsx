import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";

import { systemQuery } from "@/lib/queries/system";
import { teamQuery, teamsListQuery } from "@/lib/queries/teams";
import { templatesListQuery } from "@/lib/queries/templates";
import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import SystemProvider from "@/components/system/system-provider";
import TeamNavbar from "@/components/team/team-navbar";
import TeamProvider from "@/components/team/team-provider";
import TeamsProvider from "@/components/team/teams-provider";
import TemplatesProvider from "@/components/templates/templates-provider";
import { UpdateToastProvider } from "@/components/update/check-for-updates-provider";

export const Route = createFileRoute("/$team_id/_team")({
  loader: ({ context: { queryClient }, params }) => {
    // Warm the cache (this also runs on intent preload) without blocking the
    // navigation — the components below render immediately and show skeletons.
    void queryClient.prefetchQuery(teamsListQuery());
    void queryClient.prefetchQuery(systemQuery());
    void queryClient.prefetchQuery(templatesListQuery());
    void queryClient.prefetchQuery(teamQuery({ teamId: params.team_id }));
  },
  component: TeamLayout,
});

function TeamLayout() {
  const { team_id: teamId } = Route.useParams();
  const { data: teamsData } = useQuery(teamsListQuery());

  // Redirect to the first team if the requested team isn't one of the user's.
  // Moved out of the loader so navigation isn't blocked on the teams list.
  if (teamsData && teamsData.teams.length >= 1 && !teamsData.teams.some((t) => t.id === teamId)) {
    return <Navigate to="/$team_id" params={{ team_id: teamsData.teams[0].id }} replace />;
  }

  return (
    <SystemProvider>
      <TemplatesProvider>
        <UpdateToastProvider>
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
        </UpdateToastProvider>
      </TemplatesProvider>
    </SystemProvider>
  );
}
