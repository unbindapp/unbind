"use client";

import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import {
  commandPanelTeam,
  commandPanelTeamRootPage,
} from "@/components/team/command-panel/constants";
import TeamCommandPanelTrigger from "@/components/team/command-panel/team-command-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";

type TProps = {
  teamId: string;
  className?: string;
};

export default function NewTeamButton({ teamId, className }: TProps) {
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

  return (
    <TeamCommandPanelTrigger
      modalId={commandPanelTeam}
      open={open}
      setOpen={setOpen}
      teamId={teamId}
    >
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
