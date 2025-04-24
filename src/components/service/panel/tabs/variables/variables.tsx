import ErrorCard from "@/components/error-card";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import VariableCard, {
  TVariableOrReferenceShallow,
} from "@/components/service/panel/tabs/variables/variable-card";
import VariablesHeader from "@/components/service/panel/tabs/variables/variables-header";
import { useVariables } from "@/components/service/panel/tabs/variables/variables-provider";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { KeyIcon } from "lucide-react";

const placeholderArray = Array.from({ length: 10 });

export default function Variables({}: { service: TServiceShallow }) {
  const {
    list: { data, isPending, error },
  } = useVariables();
  const variables: TVariableOrReferenceShallow[] | undefined = data
    ? [
        ...data.variables.map((v) => ({ variable_type: "regular", ...v }) as const),
        ...data.variable_references.map((v) => ({ variable_type: "reference", ...v }) as const),
      ]
    : undefined;

  return (
    <TabWrapper>
      <VariablesHeader />
      {variables &&
        variables.length > 0 &&
        variables.map((variable, i) => <VariableCard key={i} variable={variable} />)}
      {variables && variables.length === 0 && (
        <NoItemsCard Icon={KeyIcon}>No variables yet</NoItemsCard>
      )}
      {!data && isPending && placeholderArray.map((_, i) => <VariableCard key={i} isPlaceholder />)}
      {!data && !isPending && error && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
