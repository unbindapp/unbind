"use client";

import CreateVariablesForm from "@/components/variables/create-variables-form";
import RawVariableEditor from "@/components/variables/raw-variable-editor";
import { useVariables } from "@/components/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { FilePenLineIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

export default function VariablesHeader({ tokensDisabled }: { tokensDisabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    type,
    list: { data: variablesData, isPending, error },
  } = useVariables();

  const title = useMemo(() => {
    if (!isPending && error) {
      if (type === "team") return "Team Variables";
      if (type === "project") return "Project Variables";
      return "Variables";
    }

    if (isPending) {
      if (type === "team") return "Team Variables (1)";
      if (type === "project") return "Project Variables (1)";
      return "10 Variables";
    }

    const variableCount = variablesData.variables.length + variablesData.variable_references.length;

    if (type === "team")
      return (
        <>
          Team Variables{" "}
          <span className="text-muted-foreground font-normal">({variableCount})</span>
        </>
      );
    if (type === "project")
      return (
        <>
          Project Variables{" "}
          <span className="text-muted-foreground font-normal">({variableCount})</span>
        </>
      );
    return (
      <>
        Variables <span className="text-muted-foreground font-normal">({variableCount})</span>
      </>
    );
  }, [variablesData, isPending, error, type]);

  return (
    <div
      data-type={type}
      data-pending={isPending ? true : undefined}
      className="group/header flex w-full flex-col gap-2 pt-1 pb-1 data-[type=project]:pt-0 data-[type=team]:pt-0 sm:pt-0"
    >
      <div className="flex w-full flex-col items-start justify-start gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 shrink overflow-hidden px-1">
          <h2 className="group-data-pending/header:bg-foreground group-data-pending/header:animate-skeleton min-w-0 shrink truncate text-lg leading-tight font-bold group-data-pending/header:rounded-md group-data-pending/header:text-transparent group-data-[type=project]/header:text-xl group-data-[type=team]/header:text-xl">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-start gap-1.5 pt-1 sm:-mt-1.5 sm:justify-end sm:pt-0">
          <RawVariableEditor>
            <Button
              disabled={isPending}
              fadeOnDisabled={false}
              className="group/button group-data-pending/header:bg-muted-more-foreground group-data-pending/header:animate-skeleton shrink-0 gap-1.5 px-3 py-2 font-semibold group-data-pending/header:text-transparent"
              variant="outline"
            >
              <FilePenLineIcon className="-ml-1 size-5 shrink-0" />
              <p className="min-w-0 shrink">Raw Editor</p>
            </Button>
          </RawVariableEditor>
          <Button
            disabled={isPending}
            fadeOnDisabled={false}
            data-open={isOpen ? true : undefined}
            data-closed={!isOpen ? true : undefined}
            className="group/button group-data-pending/header:bg-muted-more-foreground group-data-pending/header:animate-skeleton order-first shrink-0 gap-1.5 px-3 py-2 font-semibold group-data-pending/header:text-transparent sm:order-none"
            onClick={() => setIsOpen((o) => !o)}
            variant="outline"
          >
            <PlusIcon className="-ml-1 size-5 shrink-0 transition-transform group-data-open/button:rotate-45" />
            <p className="min-w-0 shrink">{isOpen ? "Close" : "New Variable"}</p>
          </Button>
        </div>
      </div>
      <CreateVariablesForm
        tokensDisabled={tokensDisabled}
        afterSuccessfulSubmit={() => setIsOpen(false)}
        isOpen={isOpen}
      />
    </div>
  );
}
