import { createFileRoute } from "@tanstack/react-router";

import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesHeader from "@/components/variables/variables-header";
import VariablesList from "@/components/variables/variables-list";
import VariablesProvider from "@/components/variables/variables-provider";

export const Route = createFileRoute("/_authed/$team_id/_team/settings/variables/")({
  component: TeamVariablesSettings,
});

function TeamVariablesSettings() {
  const { team_id: teamId } = Route.useParams();
  return (
    <VariablesProvider type="team" teamId={teamId}>
      <VariableReferencesProvider type="team" teamId={teamId}>
        <div className="flex w-full flex-col gap-2">
          <VariablesHeader tokensDisabled />
          <VariablesList variableTypeProps={{ type: "team", teamId }} />
        </div>
      </VariableReferencesProvider>
    </VariablesProvider>
  );
}
