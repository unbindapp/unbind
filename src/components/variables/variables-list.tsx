"use client";

import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { useVariables } from "@/components/variables/variables-provider";
import { cn } from "@/components/ui/utils";
import VariableCard, { TVariableOrReferenceShallow } from "@/components/variables/variable-card";
import { KeyIcon } from "lucide-react";
import { ReactNode, useMemo } from "react";
import { TEntityVariableTypeProps } from "@/components/variables/types";

type TProps = {
  variableTypeProps: TEntityVariableTypeProps;
};

const placeholderArray = Array.from({ length: 10 });

export default function VariablesList({ variableTypeProps }: TProps) {
  const {
    list: { data, isPending, error },
  } = useVariables();

  const variables: TVariableOrReferenceShallow[] | undefined = useMemo(
    () =>
      data
        ? [
            ...data.variable_references
              .filter((v) => v.error !== null)
              .map((v) => ({ variable_type: "reference", ...v }) as const),
            ...data.variable_references
              .filter((v) => v.error === null)
              .map((v) => ({ variable_type: "reference", ...v }) as const),
            ...data.variables.map((v) => ({ variable_type: "regular", ...v }) as const),
          ]
        : undefined,
    [data],
  );

  if (!variables && !isPending && error) {
    return (
      <Wrapper>
        <ErrorCard asElement="li" message={error.message} />;
      </Wrapper>
    );
  }

  if (!variables || isPending) {
    return (
      <Wrapper>
        {placeholderArray.map((_, i) => (
          <VariableCard asElement="li" key={i} isPlaceholder />
        ))}
      </Wrapper>
    );
  }

  if (variables && variables.length === 0) {
    return (
      <Wrapper>
        <NoItemsCard asElement="li" Icon={KeyIcon}>
          No variables yet
        </NoItemsCard>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {variables.map((variable, i) => (
        <VariableCard
          variable={variable}
          variableTypeProps={variableTypeProps}
          asElement="li"
          key={i}
        />
      ))}
    </Wrapper>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <ol className={cn("flex w-full flex-col gap-2", className)}>{children}</ol>;
}
