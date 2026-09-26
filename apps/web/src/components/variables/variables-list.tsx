"use client";

import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { providedVariablesKey } from "@/components/variables/constants";
import { pendingDatabaseUrlNames, splitProvidedVariables } from "@/components/variables/helpers";
import { TEntityVariableTypeProps } from "@/components/variables/types";
import VariableCard from "@/components/variables/variable-card";
import type { TVariableWithStaged } from "@/components/variables/variables-provider";
import { useVariables } from "@/components/variables/variables-provider";
import { TVariableShallow } from "@/lib/queries/variables";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  HourglassIcon,
  KeyIcon,
  LoaderIcon,
  WandSparklesIcon,
} from "lucide-react";
import { ReactNode, useCallback } from "react";
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

  const { isOpen: isProvidedVariablesOpen, setIsOpen: setIsProvidedVariablesOpen } =
    useProvidedVariablesOpen();

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
        <ProvidedVariablesSection
          provided={provided}
          variableTypeProps={variableTypeProps}
          isWaitingForDatabase={showSpecialDbVariablesSection}
          isOpen={isProvidedVariablesOpen}
          setIsOpen={setIsProvidedVariablesOpen}
        />
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
            disableDelete={locked || variable.updates.length > 0}
            disableEdit={locked}
            variableTypeProps={variableTypeProps}
            asElement="li"
            key={`${variable.name}:${variable.value}:${variable.staged ?? ""}`}
          />
        );
      })}
      <ProvidedVariablesSection
        provided={provided}
        variableTypeProps={variableTypeProps}
        isWaitingForDatabase={showSpecialDbVariablesSection}
        className="mt-2"
        isOpen={isProvidedVariablesOpen}
        setIsOpen={setIsProvidedVariablesOpen}
      />
    </Wrapper>
  );
}

// Open means the hosts and ports are listed under the URLs. Collapsed is the default,
// so writing false drops the key (see the project route's search middleware) and the
// service panel clears it when it closes.
function useProvidedVariablesOpen() {
  const navigate = useNavigate();

  const isOpen = useSearch({
    strict: false,
    select: (s) => (s as Record<string, unknown>)[providedVariablesKey] === true,
  });

  const setIsOpen = useCallback(
    (value: boolean) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [providedVariablesKey]: value }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  return { isOpen, setIsOpen };
}

// Values Unbind computes from the service itself. They are listed with the stored
// variables so a connection string can be copied from one place, but there is no row
// behind them to edit or delete.
function ProvidedVariablesSection({
  provided,
  variableTypeProps,
  isWaitingForDatabase,
  className,
  isOpen,
  setIsOpen,
}: {
  provided: TVariableShallow[] | undefined;
  variableTypeProps: TEntityVariableTypeProps;
  isWaitingForDatabase: boolean;
  className?: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  if (!provided || provided.length === 0) return null;

  const { urls, extras } = splitProvidedVariables(provided);
  const visible = isOpen ? [...urls, ...extras] : urls;
  const pendingNames = isWaitingForDatabase ? pendingDatabaseUrlNames(provided) : [];

  return (
    <>
      <li
        className={cn("w-full px-1 pt-3 pb-2 leading-tight font-medium wrap-break-word", className)}
      >
        Provided by Unbind{" "}
        <span className="text-muted-more-foreground font-normal">
          (<span className="text-muted-foreground">{provided.length + pendingNames.length}</span>)
        </span>
      </li>
      {pendingNames.length > 0 && (
        <WaitingForDatabaseVariables names={pendingNames} variableTypeProps={variableTypeProps} />
      )}
      {visible.map((variable) => (
        <VariableCard
          key={variable.name}
          variable={variable}
          variableTypeProps={variableTypeProps}
          asElement="li"
          hideThreeDotButton
          Icon={({ className }) => <WandSparklesIcon className={className} />}
        />
      ))}
      {extras.length > 0 && (
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="text-muted-foreground group/button w-full px-4 text-left font-medium"
          variant="ghost"
          data-open={isOpen ? "true" : undefined}
        >
          <span className="min-w-0 shrink truncate">
            {isOpen ? "Show less" : `Show ${extras.length} more`}
          </span>
          <ChevronDownIcon className="text-muted-more-foreground group-hover/button:text-muted-foreground group-active/button:text-muted-foreground -mr-0.5 size-5 shrink-0 transition-transform group-data-open/button:rotate-180" />
        </Button>
      )}
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
    <WaitingForDatabaseVariables
      names={expected.filter((v) => !existingNames.includes(v))}
      variableTypeProps={variableTypeProps}
    />
  );
}

function WaitingForDatabaseVariables({
  names,
  variableTypeProps,
}: {
  names: string[];
  variableTypeProps: TEntityVariableTypeProps;
}) {
  return (
    <>
      <div className="bg-process/3-10 border-process/3-10 text-process flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 leading-tight">
        <div className="line-icon">
          <LoaderIcon className="-ml-0.5 size-4 animate-spin" />
        </div>
        <p className="min-w-0 shrink font-medium">
          Waiting for database variables to become available...
        </p>
      </div>
      {names.map((name) => (
        <VariableCard
          key={name}
          variableTypeProps={variableTypeProps}
          asElement="li"
          Icon={({ className }) => <HourglassIcon className={cn("animate-hourglass", className)} />}
          variable={{
            type: "service",
            name,
            value: "Waiting...",
            provided: false,
            references: [],
            updates: [],
          }}
          hideThreeDotButton
        />
      ))}
    </>
  );
}
