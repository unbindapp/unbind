import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesHeader from "@/components/variables/variables-header";
import VariablesList from "@/components/variables/variables-list";
import VariablesProvider from "@/components/variables/variables-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { notFound } from "next/navigation";

type TProps = {
  params: Promise<{ team_id: string }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId } = await params;

  const res = await ResultAsync.fromPromise(
    apiServer.variables.list({ type: "team", teamId }),
    () => new Error(`Failed to fetch variables`),
  );

  if (res.isErr()) {
    return notFound();
  }

  return (
    <VariablesProvider type="team" teamId={teamId} initialData={res.value}>
      <VariableReferencesProvider type="team" teamId={teamId}>
        <div className="flex w-full flex-col gap-2">
          <VariablesHeader />
          <VariablesList variableTypeProps={{ type: "team", teamId }} />
        </div>
      </VariableReferencesProvider>
    </VariablesProvider>
  );
}
