"use client";

import { useProjects } from "@/components/project/projects-provider";
import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import {
  commandPanelTeamFromList,
  commandPanelTeamRootPage,
} from "@/components/team/command-panel/constants";
import TeamCommandPanelTrigger from "@/components/team/command-panel/team-command-panel";
import ProjectCard from "@/components/team/project-card";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";
import { defaultAnimationMs } from "@/lib/constants";

type TProps = {
  teamId: string;
};

export default function ProjectCardList({ teamId }: TProps) {
  const { data } = useProjects();
  const projects = data?.projects;

  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelKey);
  const [, setCommandPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelTeamRootPage),
  );

  const open = commandPanelId === commandPanelTeamFromList;
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const setOpen = (open: boolean) => {
    if (open) {
      setCommandPanelId(commandPanelTeamFromList);
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
    <ol className="flex w-full flex-wrap">
      {projects && projects.length === 0 && (
        <li className="flex w-full flex-col p-1 sm:w-1/2 lg:w-1/3">
          <TeamCommandPanelTrigger
            modalId={commandPanelTeamFromList}
            open={open}
            setOpen={setOpen}
            teamId={teamId}
          >
            <Button
              variant="ghost"
              className="text-muted-foreground flex min-h-36 w-full items-center justify-center rounded-xl border px-5 py-3.5 text-center font-medium"
            >
              <PlusIcon className="-ml-1.5 size-5 shrink-0" />
              <p className="min-w-0 shrink leading-tight">New Project</p>
            </Button>
          </TeamCommandPanelTrigger>
        </li>
      )}
      {projects &&
        projects.length > 0 &&
        projects.map((i) => (
          <ProjectCard key={i.id} project={i} className="w-full sm:w-1/2 lg:w-1/3" />
        ))}
    </ol>
  );
}
