import ErrorCard from "@/components/error-card";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import VariableCard from "@/components/service/panel/tabs/variables/variable-card";
import VariablesHeader from "@/components/service/panel/tabs/variables/variables-header";
import { useVariables } from "@/components/service/panel/tabs/variables/variables-provider";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { KeyRoundIcon } from "lucide-react";

export default function Variables({}: { service: TServiceShallow }) {
  const {
    list: { data, isPending, error },
  } = useVariables();
  const variables = data?.variables.items;

  return (
    <TabWrapper>
      <VariablesHeader />
      {variables &&
        variables.length > 0 &&
        variables.map((variable) => <VariableCard key={variable.name} variable={variable} />)}
      {variables && variables.length === 0 && (
        <NoItemsCard Icon={KeyRoundIcon}>No variables yet</NoItemsCard>
      )}
      {!data &&
        isPending &&
        Array.from({ length: 10 }).map((_, i) => <VariableCard key={i} isPlaceholder />)}
      {!data && !isPending && error && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
