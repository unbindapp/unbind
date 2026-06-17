import { createFileRoute } from "@tanstack/react-router";

import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesHeader from "@/components/variables/variables-header";
import VariablesList from "@/components/variables/variables-list";
import VariablesProvider from "@/components/variables/variables-provider";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/settings/variables/")({
  component: ProjectVariablesSettings,
});

function ProjectVariablesSettings() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  return (
    <VariablesProvider type="project" teamId={teamId} projectId={projectId}>
      <VariableReferencesProvider type="project" teamId={teamId} projectId={projectId}>
        <div className="flex w-full flex-col gap-2">
          <VariablesHeader tokensDisabled />
          <VariablesList variableTypeProps={{ type: "project", teamId, projectId }} />
        </div>
      </VariableReferencesProvider>
    </VariablesProvider>
  );
}
