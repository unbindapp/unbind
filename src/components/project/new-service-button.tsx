"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import { useProject } from "@/components/project/project-provider";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  className?: string;
};

export default function NewServiceButton({ className }: TProps) {
  const { teamId, projectId } = useProject();

  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-service", teamId, projectId }),
    [teamId, projectId],
  );

  return (
    <ContextCommandPanel
      title="Create New Service"
      description="Create a new service on Unbind"
      idSuffix="button"
      context={context}
    >
      <Button
        className={cn("bg-background-hover -my-2 rounded-lg py-2", className)}
        size="sm"
        variant="outline"
      >
        <PlusIcon className="-ml-1.5 size-5" />
        <p className="min-w-0 shrink">New Service</p>
      </Button>
    </ContextCommandPanel>
  );
}
