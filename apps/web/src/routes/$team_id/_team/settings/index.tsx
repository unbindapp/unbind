import { createFileRoute } from "@tanstack/react-router";

import GeneralTabContent from "@/components/team/settings/general-tab-content";

export const Route = createFileRoute("/$team_id/_team/settings/")({
  component: TeamGeneralSettings,
});

function TeamGeneralSettings() {
  const { team_id: teamId } = Route.useParams();
  return <GeneralTabContent teamId={teamId} />;
}
