"use client";

import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { useVariables } from "@/components/variables/variables-provider";
import { cn } from "@/components/ui/utils";
import VariableCard, { TVariableOrReferenceShallow } from "@/components/variables/variable-card";
import { HourglassIcon, KeyIcon, LoaderIcon } from "lucide-react";
import { ReactNode, useMemo } from "react";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import { z } from "zod";

type TProps = {
  variableTypeProps: TEntityVariableTypeProps;
};

const placeholderArray = Array.from({ length: 10 });

export const SPECIAL_DB_VARIABLES_ENUM = z.enum([
  "DATABASE_URL",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
]);

type TSpecialDbVariable = z.infer<typeof SPECIAL_DB_VARIABLES_ENUM>;

export function arrayHasAllSpecialDbVariables(arr: string[]) {
  return SPECIAL_DB_VARIABLES_ENUM.options.every((val) => arr.includes(val));
}

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

  const shouldHaveSpecialDbVariables =
    variableTypeProps.type === "service" && variableTypeProps.service.type === "database";

  const hasAllSpecialDbVariables = arrayHasAllSpecialDbVariables(variables.map((v) => v.name));

  const showSpecialDbVariablesSection = shouldHaveSpecialDbVariables && !hasAllSpecialDbVariables;

  if (variables.length === 0) {
    return (
      <Wrapper>
        {showSpecialDbVariablesSection && (
          <SpecialDbVariablesSection variableTypeProps={variableTypeProps} />
        )}
        {!showSpecialDbVariablesSection && (
          <NoItemsCard asElement="li" Icon={KeyIcon}>
            No variables yet
          </NoItemsCard>
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {showSpecialDbVariablesSection && (
        <SpecialDbVariablesSection variableTypeProps={variableTypeProps} />
      )}
      {showSpecialDbVariablesSection && variables.length > 0 && (
        <div className="w-full px-0.5 py-1.5">
          <div className="bg-process/32 h-px w-full rounded-full" />
        </div>
      )}
      {variables
        .sort((a, b) => variablesSort(a, b, variableTypeProps))
        .map((variable, i) => (
          <VariableCard
            variable={variable}
            disableDelete={
              variable.variable_type === "regular" &&
              variableTypeProps.type === "service" &&
              variableTypeProps.service.type === "database" &&
              SPECIAL_DB_VARIABLES_ENUM.options.includes(variable.name as TSpecialDbVariable)
            }
            disableEdit={
              variable.variable_type === "reference" ||
              (variable.variable_type === "regular" &&
                variableTypeProps.type === "service" &&
                variableTypeProps.service.type === "database" &&
                variable.name === SPECIAL_DB_VARIABLES_ENUM.Values.DATABASE_URL)
            }
            disableCopy={variable.variable_type === "reference"}
            variableTypeProps={variableTypeProps}
            asElement="li"
            key={i}
          />
        ))}
    </Wrapper>
  );
}

function variablesSort(
  a: TVariableOrReferenceShallow,
  b: TVariableOrReferenceShallow,
  variableTypeProps: TEntityVariableTypeProps,
) {
  if (a.variable_type === "reference" && b.variable_type !== "reference") {
    return -1;
  }
  if (a.variable_type !== "reference" && b.variable_type === "reference") {
    return 1;
  }
  if (a.variable_type === "reference" && b.variable_type === "reference") {
    return 0;
  }
  if (variableTypeProps.type === "service" && variableTypeProps.service.type === "database") {
    if (a.name === "DATABASE_URL") return -1;
    if (b.name === "DATABASE_URL") return 1;
    if (a.name === "DATABASE_USERNAME") return -1;
    if (b.name === "DATABASE_USERNAME") return 1;
    if (a.name === "DATABASE_PASSWORD") return -1;
    if (b.name === "DATABASE_PASSWORD") return 1;
  }
  return 0;
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <ol className={cn("flex w-full flex-col gap-2", className)}>{children}</ol>;
}

function SpecialDbVariablesSection({
  variableTypeProps,
}: {
  variableTypeProps: TEntityVariableTypeProps;
}) {
  return (
    <>
      <div className="bg-process/8 border-process/8 text-process flex w-full items-start gap-2 rounded-lg border px-3 py-2.5">
        <LoaderIcon className="mt-0.5 -ml-0.5 size-4 animate-spin" />
        <p className="min-w-0 shrink leading-tight font-medium">
          Waiting for database variables to become available...
        </p>
      </div>
      {SPECIAL_DB_VARIABLES_ENUM.options.map((val) => (
        <VariableCard
          key={val}
          variableTypeProps={variableTypeProps}
          asElement="li"
          Icon={({ className }) => <HourglassIcon className={cn("animate-hourglass", className)} />}
          variable={{
            type: "service",
            name: val,
            variable_type: "regular",
            value: "Waiting...",
          }}
          hideThreeDotButton
        />
      ))}
    </>
  );
}
