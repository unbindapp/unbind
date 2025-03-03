"use client";

import {
  commandPanelKey,
  commandPanelPageKey,
  commandPanelProject,
  commandPanelProjectRootPage,
} from "@/components/command-panel/constants";
import { ProjectCommandPanelTrigger } from "@/components/command-panel/project/project-command-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
  teamId: string;
  projectId: string;
  className?: string;
  shortcutEnabled?: boolean;
};

export default function NewServiceButton({
  teamId,
  projectId,
  shortcutEnabled = true,
  className,
}: Props) {
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
      }, 150);
    }
  };

  useHotkeys(
    "mod+k",
    () => {
      setCommandPanelId(commandPanelProject);
    },
    {
      enabled: shortcutEnabled,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  return (
    <ProjectCommandPanelTrigger open={open} setOpen={setOpen} teamId={teamId} projectId={projectId}>
      <Button className={cn("bg-background-hover -my-2", className)} size="sm" variant="outline">
        <PlusIcon className="-ml-1.5 size-5" />
        <p className="min-w-0 shrink">New Service</p>
      </Button>
    </ProjectCommandPanelTrigger>
  );
}
