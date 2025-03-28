"use client";

import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import {
  commandPanelProject,
  commandPanelProjectRootPage,
} from "@/components/project/command-panel/constants";
import ProjectCommandPanelTrigger from "@/components/project/command-panel/project-command-panel";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { defaultAnimationMs } from "@/lib/constants";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";

type TProps = {
  className?: string;
};

export default function NewServiceButton({ className }: TProps) {
  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelKey);
  const [, setCommandPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelProjectRootPage),
  );

  const open = commandPanelId === commandPanelProject;
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const setOpen = (open: boolean) => {
    if (open) {
      setCommandPanelId(commandPanelProject);
    } else {
      setCommandPanelId(null);
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      timeout.current = setTimeout(() => {
        setCommandPanelPageId(null);
      }, defaultAnimationMs);
    }
  };

  return (
    <ProjectCommandPanelTrigger open={open} setOpen={setOpen} modalId={commandPanelProject}>
      <Button
        className={cn("bg-background-hover -my-2 rounded-lg py-2", className)}
        size="sm"
        variant="outline"
      >
        <PlusIcon className="-ml-1.5 size-5" />
        <p className="min-w-0 shrink">New Service</p>
      </Button>
    </ProjectCommandPanelTrigger>
  );
}
