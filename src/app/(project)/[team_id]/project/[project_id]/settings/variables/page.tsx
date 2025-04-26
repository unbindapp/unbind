import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesHeader from "@/components/variables/variables-header";
import VariablesList from "@/components/variables/variables-list";
import VariablesProvider from "@/components/variables/variables-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  const { teamId, projectId } = await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings/variables`,
  });

  const initialData = await ResultAsync.fromPromise(
    apiServer.variables.list({ type: "project", teamId, projectId }),
    () => new Error(`Failed to fetch variables`),
  );

  return (
    <VariablesProvider
      type="project"
      teamId={teamId}
      projectId={projectId}
      initialData={initialData.isOk() ? initialData.value : undefined}
    >
      <VariableReferencesProvider type="project" teamId={teamId} projectId={projectId}>
        <div className="flex w-full flex-col gap-2">
          <VariablesHeader tokensDisabled />
          <VariablesList variableTypeProps={{ type: "project", teamId, projectId }} />
        </div>
      </VariableReferencesProvider>
    </VariablesProvider>
  );
}
