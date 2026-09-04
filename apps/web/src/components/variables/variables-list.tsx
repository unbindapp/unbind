"use client";

import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { useVariables } from "@/components/variables/variables-provider";
import { cn } from "@/components/ui/utils";
import VariableCard from "@/components/variables/variable-card";
import { HourglassIcon, KeyIcon, LoaderIcon } from "lucide-react";
import { ReactNode } from "react";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import { TVariableShallow } from "@/lib/queries/variables";
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

export function specialDbVariablesFor(databaseType: string): string[] {
  if (databaseType === "redis") return SPECIAL_REDIS_VARIABLES_ENUM.options;
  if (databaseType === "clickhouse") return SPECIAL_CLICKHOUSE_VARIABLES_ENUM.options;
  return SPECIAL_DB_VARIABLES_ENUM.options;
}

export function arrayHasAllSpecialDbVariables(arr: string[], database_type: string) {
  return specialDbVariablesFor(database_type).every((val) => arr.includes(val));
}

function databaseTypeOf(variableTypeProps: TEntityVariableTypeProps) {
  if (variableTypeProps.type !== "service" || variableTypeProps.service.type !== "database") {
    return null;
  }
  return variableTypeProps.service.database_type || "";
}

// Auto-generated database variables are written by the operator and can't be changed
function isLockedVariable(variable: TVariableShallow, variableTypeProps: TEntityVariableTypeProps) {
  const databaseType = databaseTypeOf(variableTypeProps);
  if (databaseType === null) return false;
  return specialDbVariablesFor(databaseType).includes(variable.name);
}

export default function VariablesList({ variableTypeProps }: TProps) {
  const {
    list: { data, isPending, error },
  } = useVariables();

  const variables = data?.variables;

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

  const databaseType = databaseTypeOf(variableTypeProps);
  const showSpecialDbVariablesSection =
    databaseType !== null &&
    !arrayHasAllSpecialDbVariables(
      variables.map((v) => v.name),
      databaseType,
    );

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
      {variables.map((variable) => {
        const locked = isLockedVariable(variable, variableTypeProps);
        return (
          <VariableCard
            variable={variable}
            disableDelete={locked}
            disableEdit={locked}
            variableTypeProps={variableTypeProps}
            asElement="li"
            key={`${variable.name}:${variable.value}`}
          />
        );
      })}
    </Wrapper>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <ol className={cn("flex w-full flex-col gap-2", className)}>{children}</ol>;
}

function SpecialDbVariablesSection({
  variables,
  variableTypeProps,
}: {
  variables: TVariableShallow[];
  variableTypeProps: TEntityVariableTypeProps;
}) {
  const existingNames = variables.map((v) => v.name);
  const expected = specialDbVariablesFor(databaseTypeOf(variableTypeProps) ?? "");

  return (
    <>
      <div className="bg-process/8 border-process/8 text-process flex w-full items-start gap-2 rounded-lg border px-3 py-2.5">
        <LoaderIcon className="mt-0.5 -ml-0.5 size-4 animate-spin" />
        <p className="min-w-0 shrink leading-tight font-medium">
          Waiting for database variables to become available...
        </p>
      </div>
      {expected
        .filter((v) => !existingNames.includes(v))
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
              value: "Waiting...",
              references: [],
            }}
            hideThreeDotButton
          />
        ))}
    </>
  );
}
