"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  teamId: string;
  className?: string;
};

export default function NewProjectButton({ teamId, className }: TProps) {
  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-project", teamId }),
    [teamId],
  );

  return (
    <ContextCommandPanel
      title="Create New Project"
      description="Create a new project on Unbind"
      triggerType="button"
      context={context}
    >
      <Button
        className={cn("bg-background-hover -my-2 rounded-lg py-2", className)}
        size="sm"
        variant="outline"
      >
        <PlusIcon className="-ml-1.5 size-5" />
        <p className="min-w-0 shrink">New Project</p>
      </Button>
    </ContextCommandPanel>
  );
}
