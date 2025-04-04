import CreateVariablesForm from "@/components/service/tabs/variables/create-variables-form";
import { useVariables } from "@/components/service/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

export default function VariablesHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    list: { data, isPending },
  } = useVariables();

  return (
    <div
      data-pending={isPending ? true : undefined}
      className="group/header flex w-full flex-col gap-2 pb-1"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="min-w-0 shrink overflow-hidden px-1">
          <h2 className="group-data-pending/header:bg-foreground group-data-pending/header:animate-skeleton min-w-0 shrink truncate text-lg leading-tight font-bold group-data-pending/header:rounded-md group-data-pending/header:text-transparent">
            {isPending || !data
              ? "10 Variables"
              : data.variables.length === 0
                ? "No Variables"
                : `${data.variables.length} Variable${data.variables.length > 1 ? "s" : ""}`}
          </h2>
        </div>
        <Button
          disabled={isPending}
          fadeOnDisabled={false}
          data-open={isOpen ? true : undefined}
          data-closed={!isOpen ? true : undefined}
          className="group/button group-data-pending/header:bg-muted-more-foreground group-data-pending/header:animate-skeleton shrink-0 gap-1 px-3 py-2 group-data-pending/header:text-transparent"
          onClick={() => setIsOpen((o) => !o)}
          variant="outline"
        >
          <PlusIcon className="-ml-1 size-5 shrink-0 transition-transform group-data-open/button:rotate-45" />
          <p>{isOpen ? "Close" : "New Variable"}</p>
        </Button>
      </div>
      <CreateVariablesForm afterSuccessfulSubmit={() => setIsOpen(false)} isOpen={isOpen} />
    </div>
  );
}
