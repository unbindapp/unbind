import { createFileRoute } from "@tanstack/react-router";

import { variablesListQuery } from "@/lib/queries/variables";
import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesHeader from "@/components/variables/variables-header";
import VariablesList from "@/components/variables/variables-list";
import VariablesProvider from "@/components/variables/variables-provider";

export const Route = createFileRoute("/$team_id/project/$project_id/settings/variables/")({
  // Runs on intent preload (hover) so hovering the tab warms the cache
  // before navigation. Non-blocking; the provider shows skeletons meanwhile.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(
      variablesListQuery({ type: "project", teamId: params.team_id, projectId: params.project_id }),
    );
  },
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
