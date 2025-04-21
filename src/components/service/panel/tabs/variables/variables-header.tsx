import CreateVariablesForm from "@/components/service/panel/tabs/variables/create-variables-form";
import RawVariableEditor from "@/components/service/panel/tabs/variables/raw-variable-editor";
import { useVariables } from "@/components/service/panel/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { FilePenLineIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

export default function VariablesHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    list: { data: variablesData, isPending },
  } = useVariables();

  return (
    <div
      data-pending={isPending ? true : undefined}
      className="group/header flex w-full flex-col gap-2 pb-1"
    >
      <div className="flex w-full flex-col items-start justify-start gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between sm:pt-0">
        <div className="min-w-0 shrink overflow-hidden px-1">
          <h2 className="group-data-pending/header:bg-foreground group-data-pending/header:animate-skeleton min-w-0 shrink truncate text-lg leading-tight font-bold group-data-pending/header:rounded-md group-data-pending/header:text-transparent">
            {isPending || !variablesData
              ? "10 Variables"
              : variablesData.variables.length === 0
                ? "No Variables"
                : `${variablesData.variables.length} Variable${variablesData.variables.length > 1 ? "s" : ""}`}
          </h2>
        </div>
        <div className="flex items-center justify-end gap-1.5">
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
      <CreateVariablesForm afterSuccessfulSubmit={() => setIsOpen(false)} isOpen={isOpen} />
    </div>
  );
}
