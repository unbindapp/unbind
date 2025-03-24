import ErrorCard from "@/components/error-card";
import TabWrapper from "@/components/service/tabs/tab-wrapper";
import VariableCard from "@/components/service/tabs/variables/variable-card";
import VariablesHeader from "@/components/service/tabs/variables/variables-header";
import { useVariables } from "@/components/service/tabs/variables/variables-provider";

export default function Variables() {
  const {
    list: { data, isPending, error },
  } = useVariables();
  const variables = data?.variables;

  return (
    <TabWrapper>
      <VariablesHeader />
      {variables &&
        variables.length > 0 &&
        variables.map((variable) => <VariableCard key={variable.name} variable={variable} />)}
      {variables && variables.length === 0 && (
        <div className="text-muted-foreground px-2 py-5 text-center leading-tight font-medium">
          No variables yet
        </div>
      )}
      {!data &&
        isPending &&
        Array.from({ length: 10 }).map((_, i) => <VariableCard key={i} isPlaceholder />)}
      {!data && !isPending && error && <ErrorCard message={error.message} />}
    </TabWrapper>
  );
}
