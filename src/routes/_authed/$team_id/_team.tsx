import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { systemQuery } from "@/api/services/system";
import { teamQuery, teamsListQuery } from "@/api/services/teams";
import { templatesListQuery } from "@/api/services/templates";
import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import SystemProvider from "@/components/system/system-provider";
import TeamNavbar from "@/components/team/team-navbar";
import TeamProvider from "@/components/team/team-provider";
import TeamsProvider from "@/components/team/teams-provider";
import TemplatesProvider from "@/components/templates/templates-provider";
import { UpdateToastProvider } from "@/components/update/check-for-updates-provider";

export const Route = createFileRoute("/_authed/$team_id/_team")({
  loader: async ({ context: { queryClient }, params }) => {
    const [{ teams }] = await Promise.all([
      queryClient.ensureQueryData(teamsListQuery()),
      queryClient.ensureQueryData(systemQuery()),
      queryClient.ensureQueryData(templatesListQuery()),
    ]);
    // Redirect to the first team if the requested team isn't one of the user's.
    if (teams.length >= 1 && !teams.some((t) => t.id === params.team_id)) {
      throw redirect({ to: "/$team_id", params: { team_id: teams[0].id } });
    }
    await queryClient.ensureQueryData(teamQuery(params.team_id));
  },
  component: TeamLayout,
});

function TeamLayout() {
  const { team_id: teamId } = Route.useParams();
  const { data: teamsData } = useSuspenseQuery(teamsListQuery());
  const { data: templatesData } = useSuspenseQuery(templatesListQuery());
  const { data: systemData } = useSuspenseQuery(systemQuery());

  return (
    <SystemProvider initialData={systemData}>
      <TemplatesProvider data={templatesData}>
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
