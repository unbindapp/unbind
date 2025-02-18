"use client";

import {
  commandPanelKey,
  commandPanelPageKey,
  commandPanelTeamFromList,
  commandPanelTeamRootPage,
} from "@/components/command-panel/constants";
import { TeamCommandPanelTrigger } from "@/components/command-panel/team/team-command-panel";
import ProjectCard from "@/components/team/project-card";
import { Button } from "@/components/ui/button";
import { api } from "@/server/trpc/setup/client";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";

type Props = {
  teamId: string;
};

export default function ProjectCardList({ teamId }: Props) {
  const [, { data }] = api.main.getProjects.useSuspenseQuery({
    teamId,
  });
  const projects = data?.projects;

  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelKey);
  const [, setCommandPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelTeamRootPage)
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
      }, 150);
    }
  };

  return (
    <ol className="w-full flex flex-wrap">
      {projects && projects.length === 0 && (
        <li className="w-full flex flex-col p-1 sm:w-1/2 lg:w-1/3">
          <TeamCommandPanelTrigger
            open={open}
            setOpen={setOpen}
            teamId={teamId}
          >
            <Button
              variant="ghost"
              className="w-full text-muted-foreground font-medium text-center flex justify-center items-center min-h-36 border rounded-xl px-5 py-3.5"
            >
              <PlusIcon className="size-5 -ml-1.5 shrink-0" />
              <p className="shrink min-w-0 leading-tight">New Project</p>
            </Button>
          </TeamCommandPanelTrigger>
        </li>
      )}
      {projects &&
        projects.length > 0 &&
        projects.map((i) => (
          <ProjectCard
            key={i.id}
            project={i}
            className="w-full sm:w-1/2 lg:w-1/3"
          />
        ))}
    </ol>
  );
}
