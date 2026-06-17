import { createFileRoute } from "@tanstack/react-router";

import { variablesListQuery } from "@/api/queries/variables";
import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesHeader from "@/components/variables/variables-header";
import VariablesList from "@/components/variables/variables-list";
import VariablesProvider from "@/components/variables/variables-provider";

export const Route = createFileRoute("/$team_id/_team/settings/variables/")({
  // Runs on intent preload (hover) so hovering the tab warms the cache
  // before navigation. Non-blocking; the provider shows skeletons meanwhile.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(variablesListQuery({ type: "team", teamId: params.team_id }));
  },
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
