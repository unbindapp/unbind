"use client";

import { commandPanelKey, commandPanelPageKey } from "@/components/command-panel/constants";
import {
  commandPanelProjectFromList,
  commandPanelProjectRootPage,
} from "@/components/project/command-panel/constants";
import { ProjectCommandPanelTrigger } from "@/components/project/command-panel/project-command-panel";
import ServiceCard from "@/components/service/service-card";
import { useServices } from "@/components/service/services-provider";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";

export default function ServiceCardList() {
  const {
    query: { data },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const services = data?.services;

  const [commandPanelId, setCommandPanelId] = useQueryState(commandPanelKey);
  const [, setCommandPanelPageId] = useQueryState(
    commandPanelPageKey,
    parseAsString.withDefault(commandPanelProjectRootPage),
  );

  const open = commandPanelId === commandPanelProjectFromList;
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const setOpen = (open: boolean) => {
    if (open) {
      setCommandPanelId(commandPanelProjectFromList);
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
    <ol className="flex w-full flex-wrap">
      {services && services.length === 0 && (
        <li className="flex w-full flex-col p-1 sm:w-1/2 lg:w-1/3">
          <ProjectCommandPanelTrigger
            open={open}
            setOpen={setOpen}
            teamId={teamId}
            projectId={projectId}
          >
            <Button
              variant="ghost"
              className="text-muted-foreground flex min-h-36 w-full items-center justify-center rounded-xl border px-5 py-3.5 text-center font-medium"
            >
              <PlusIcon className="-ml-1.5 size-5 shrink-0" />
              <p className="min-w-0 shrink leading-tight">New Service</p>
            </Button>
          </ProjectCommandPanelTrigger>
        </li>
      )}
      {services &&
        services.length > 0 &&
        services.map((s) => {
          return (
            <ServiceCard
              key={s.id}
              service={s}
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              className="w-full sm:w-1/2 lg:w-1/3"
            />
          );
        })}
    </ol>
  );
}
