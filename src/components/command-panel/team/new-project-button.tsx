"use client";

import {
  commandPanelKey,
  commandPanelPageKey,
  commandPanelTeam,
  commandPanelTeamRootPage,
} from "@/components/command-panel/constants";
import { TeamCommandPanelTrigger } from "@/components/command-panel/team/team-command-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type TProps = {
  teamId: string;
  className?: string;
  shortcutEnabled?: boolean;
};

export default function NewTeamButton({ teamId, shortcutEnabled = true, className }: TProps) {
  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelKey);
  const [, setCommandPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelTeamRootPage),
  );

  const open = commandPanelId === commandPanelTeam;
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const setOpen = (open: boolean) => {
    if (open) {
      setCommandPanelId(commandPanelTeam);
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
      setCommandPanelId(commandPanelTeam);
    },
    {
      enabled: shortcutEnabled,
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
  );

  return (
    <TeamCommandPanelTrigger open={open} setOpen={setOpen} teamId={teamId}>
      <Button
        className={cn("bg-background-hover -my-2 rounded-lg py-2", className)}
        size="sm"
        variant="outline"
      >
        <PlusIcon className="-ml-1.5 size-5" />
        <p className="min-w-0 shrink">New Project</p>
      </Button>
    </TeamCommandPanelTrigger>
  );
}
