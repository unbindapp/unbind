"use client";

import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { useVariables } from "@/components/variables/variables-provider";
import { cn } from "@/components/ui/utils";
import VariableCard from "@/components/variables/variable-card";
import { HourglassIcon, KeyIcon, LoaderIcon, WandSparklesIcon } from "lucide-react";
import { ReactNode } from "react";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import { TVariableShallow } from "@/lib/queries/variables";
import type { TVariableWithStaged } from "@/components/variables/variables-provider";
import { z } from "zod";

type TProps = {
  variableTypeProps: TEntityVariableTypeProps;
};

const placeholderArray = Array.from({ length: 10 });

// The credentials the engine generates. Everything else about reaching a database
// is computed from them, so these are what the panel waits for.
const DB_CREDENTIALS = z.enum(["DATABASE_USERNAME", "DATABASE_PASSWORD"]);

export const SPECIAL_DB_VARIABLES_ENUM = z.enum([
  ...DB_CREDENTIALS.options,
  "DATABASE_DEFAULT_DB_NAME",
]);
export const SPECIAL_REDIS_VARIABLES_ENUM = z.enum([...DB_CREDENTIALS.options]);

export function specialDbVariablesFor(databaseType: string): string[] {
  if (databaseType === "redis") return SPECIAL_REDIS_VARIABLES_ENUM.options;
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

// The server owns the list of variables it writes itself, so the lock icon can never
// drift from what the API actually enforces
function isLockedVariable(
  variable: TVariableWithStaged,
  variableTypeProps: TEntityVariableTypeProps,
) {
  if (variableTypeProps.type !== "service") return false;
  return variableTypeProps.service.config.protected_variables.includes(variable.name);
}

export default function VariablesList({ variableTypeProps }: TProps) {
  const {
    list: { isPending, error },
    variables,
    provided,
  } = useVariables();

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
        <ProvidedVariablesSection provided={provided} variableTypeProps={variableTypeProps} />
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
          <div className="bg-process/7-10 h-px w-full rounded-full" />
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
            key={`${variable.name}:${variable.value}:${variable.staged ?? ""}`}
          />
        );
      })}
      <ProvidedVariablesSection provided={provided} variableTypeProps={variableTypeProps} />
    </Wrapper>
  );
}

// Values Unbind computes from the service itself. They are listed with the stored
// variables so a connection string can be copied from one place, but there is no row
// behind them to edit or delete.
function ProvidedVariablesSection({
  provided,
  variableTypeProps,
}: {
  provided: TVariableShallow[] | undefined;
  variableTypeProps: TEntityVariableTypeProps;
}) {
  if (!provided || provided.length === 0) return null;

  return (
    <>
      <div className="mt-1 flex w-full items-center gap-2 px-1 pt-2">
        <p className="text-muted-foreground min-w-0 shrink text-sm leading-tight font-medium">
          Provided by Unbind
        </p>
        <div className="bg-border h-px min-w-0 flex-1 rounded-full" />
      </div>
      {provided.map((variable) => (
        <VariableCard
          key={variable.name}
          variable={variable}
          variableTypeProps={variableTypeProps}
          asElement="li"
          hideThreeDotButton
          Icon={({ className }) => <WandSparklesIcon className={className} />}
        />
      ))}
    </>
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
      <div className="bg-process/3-10 border-process/3-10 text-process flex w-full items-start gap-2 rounded-lg border px-3 py-2.5">
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
              provided: false,
              references: [],
            }}
            hideThreeDotButton
          />
        ))}
    </>
  );
}
