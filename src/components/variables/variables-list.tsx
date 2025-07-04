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

const SHARED_SPECIAL_DB_VARIABLES = z.enum([
  "DATABASE_URL",
  "DATABASE_USERNAME",
  "DATABASE_PASSWORD",
  "DATABASE_HOST",
  "DATABASE_PORT",
]);

export const SPECIAL_DB_VARIABLES_ENUM = z.enum([
  ...SHARED_SPECIAL_DB_VARIABLES.options,
  "DATABASE_DEFAULT_DB_NAME",
]);
export const SPECIAL_REDIS_VARIABLES_ENUM = z.enum([...SHARED_SPECIAL_DB_VARIABLES.options]);
export const SPECIAL_CLICKHOUSE_VARIABLES_ENUM = z.enum([
  ...SHARED_SPECIAL_DB_VARIABLES.options,
  "DATABASE_DEFAULT_DB_NAME",
  "DATABASE_HTTP_URL",
  "DATABASE_HTTP_PORT",
]);

const ALL_SPECIAL_DB_VARIABLES: string[] = Array.from(
  new Set([
    ...SHARED_SPECIAL_DB_VARIABLES.options,
    ...SPECIAL_DB_VARIABLES_ENUM.options,
    ...SPECIAL_REDIS_VARIABLES_ENUM.options,
    ...SPECIAL_CLICKHOUSE_VARIABLES_ENUM.options,
  ]),
);

export function arrayHasAllSpecialDbVariables(arr: string[], database_type: string) {
  let variables: string[] = SPECIAL_DB_VARIABLES_ENUM.options;

  if (database_type === "redis") {
    variables = SPECIAL_REDIS_VARIABLES_ENUM.options;
  } else if (database_type === "clickhouse") {
    variables = SPECIAL_CLICKHOUSE_VARIABLES_ENUM.options;
  }

  return variables.every((val) => arr.includes(val));
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
        <ErrorCard asElement="li" message={error.message} />
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

  const hasAllSpecialDbVariables =
    variableTypeProps.type === "service" && variableTypeProps.service.type === "database"
      ? arrayHasAllSpecialDbVariables(
          variables.map((v) => v.name),
          variableTypeProps.service.database_type || "",
        )
      : false;

  const showSpecialDbVariablesSection = shouldHaveSpecialDbVariables && !hasAllSpecialDbVariables;

  if (variables.length === 0) {
    return (
      <Wrapper>
        {showSpecialDbVariablesSection && (
          <SpecialDbVariablesSection variableTypeProps={variableTypeProps} variables={variables} />
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
        <SpecialDbVariablesSection variableTypeProps={variableTypeProps} variables={variables} />
      )}
      {showSpecialDbVariablesSection && variables.length > 0 && (
        <div className="w-full px-0.5 py-1.5">
          <div className="bg-process/32 h-px w-full rounded-full" />
        </div>
      )}
      {variables
        .sort((a, b) => variablesSort(a, b, variableTypeProps))
        .map((variable) => (
          <VariableCard
            variable={variable}
            disableDelete={shouldDeleteBeDisabled(variable, variableTypeProps)}
            disableEdit={shouldEditBeDisabled(variable, variableTypeProps)}
            disableCopy={variable.variable_type === "reference"}
            variableTypeProps={variableTypeProps}
            asElement="li"
            key={`${variable.variable_type}:${variable.name}:${variable.value}`}
          />
        ))}
    </Wrapper>
  );
}

function shouldDeleteBeDisabled(
  variable: TVariableOrReferenceShallow,
  variableTypeProps: TEntityVariableTypeProps,
) {
  if (
    variable.variable_type === "regular" &&
    variableTypeProps.type === "service" &&
    variableTypeProps.service.type === "database"
  ) {
    let variables: string[] = SPECIAL_DB_VARIABLES_ENUM.options;
    if (variableTypeProps.service.database_type === "redis") {
      variables = SPECIAL_REDIS_VARIABLES_ENUM.options;
    } else if (variableTypeProps.service.database_type === "clickhouse") {
      variables = SPECIAL_CLICKHOUSE_VARIABLES_ENUM.options;
    }

    return variables.includes(variable.name);
  }
  return false;
}

function shouldEditBeDisabled(
  variable: TVariableOrReferenceShallow,
  variableTypeProps: TEntityVariableTypeProps,
) {
  if (variable.variable_type === "reference") {
    return true;
  }
  if (
    variable.variable_type === "regular" &&
    variableTypeProps.type === "service" &&
    variableTypeProps.service.type === "database"
  ) {
    let variables: string[] = SPECIAL_DB_VARIABLES_ENUM.options;
    if (variableTypeProps.service.database_type === "redis") {
      variables = SPECIAL_REDIS_VARIABLES_ENUM.options;
    } else if (variableTypeProps.service.database_type === "clickhouse") {
      variables = SPECIAL_CLICKHOUSE_VARIABLES_ENUM.options;
    }

    return variables.includes(variable.name);
  }
  return false;
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
    const aIndex = ALL_SPECIAL_DB_VARIABLES.indexOf(a.name);
    const bIndex = ALL_SPECIAL_DB_VARIABLES.indexOf(b.name);
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
  }
  return 0;
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <ol className={cn("flex w-full flex-col gap-2", className)}>{children}</ol>;
}

function SpecialDbVariablesSection({
  variables,
  variableTypeProps,
}: {
  variables: TVariableOrReferenceShallow[];
  variableTypeProps: TEntityVariableTypeProps;
}) {
  const regularVariables = variables
    .filter((v) => v.variable_type === "regular")
    .map((v) => v.name);

  let variablesForFilter: string[] = SPECIAL_DB_VARIABLES_ENUM.options;
  if (variableTypeProps.type === "service" && variableTypeProps.service.database_type === "redis") {
    variablesForFilter = SPECIAL_REDIS_VARIABLES_ENUM.options;
  } else if (
    variableTypeProps.type === "service" &&
    variableTypeProps.service.database_type === "clickhouse"
  ) {
    variablesForFilter = SPECIAL_CLICKHOUSE_VARIABLES_ENUM.options;
  }

  return (
    <>
      <div className="bg-process/8 border-process/8 text-process flex w-full items-start gap-2 rounded-lg border px-3 py-2.5">
        <LoaderIcon className="mt-0.5 -ml-0.5 size-4 animate-spin" />
        <p className="min-w-0 shrink leading-tight font-medium">
          Waiting for database variables to become available...
        </p>
      </div>
      {variablesForFilter
        .filter((v) => !regularVariables.includes(v))
        .map((val) => (
          <VariableCard
            key={val}
            variableTypeProps={variableTypeProps}
            asElement="li"
            Icon={({ className }) => (
              <HourglassIcon className={cn("animate-hourglass", className)} />
            )}
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
