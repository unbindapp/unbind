"use client";

import CommandPanelTrigger from "@/components/command-panel/command-panel-trigger";
import {
  commandPanelIdKey,
  commandPanelPageIdKey,
} from "@/components/command-panel/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useHotkeys } from "react-hotkeys-hook";

type Props = {
  teamId: string;
  projectId: string;
  className?: string;
  shortcutEnabled?: boolean;
};

const newServiceId = "new_service";

export default function NewServiceButton({
  teamId,
  projectId,
  shortcutEnabled = true,
  className,
}: Props) {
  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelIdKey);
  const [, setCommandPanelPageId] = useQueryState(commandPanelPageIdKey);
  const open = commandPanelId === newServiceId;
  const setOpen = (open: boolean) => {
    if (open) {
      setCommandPanelId(newServiceId);
      return;
    }
    setCommandPanelId(null);
    setCommandPanelPageId(null);
  };

  useHotkeys(
    "mod+k",
    () => {
      setCommandPanelId(newServiceId);
    },
    {
      enabled: shortcutEnabled,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    }
  );

  return (
    <CommandPanelTrigger
      teamId={teamId}
      projectId={projectId}
      open={open}
      setOpen={setOpen}
    >
      <Button
        className={cn("bg-background-hover -my-2", className)}
        size="sm"
        variant="outline"
      >
        <PlusIcon className="-ml-1.5 size-5" />
        <p className="shrink min-w-0">New Service</p>
      </Button>
    </CommandPanelTrigger>
  );
}
