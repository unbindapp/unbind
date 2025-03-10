"use client";

import {
  commandPanelKey,
  commandPanelPageKey,
  commandPanelProjectFromList,
  commandPanelProjectRootPage,
} from "@/components/command-panel/constants";
import { ProjectCommandPanelTrigger } from "@/components/project/command-panel/project-command-panel";
import ServiceIcon from "@/components/icons/service";
import ServiceCard from "@/components/service/service-card";
import { Button } from "@/components/ui/button";
import { groupByServiceGroup } from "@/lib/helpers";
import { api } from "@/server/trpc/setup/client";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
};

export default function ServiceCardList({ teamId, projectId, environmentId }: TProps) {
  const [, { data }] = api.main.getServices.useSuspenseQuery({
    teamId,
    projectId,
    environmentId,
  });
  const services = data?.services;
  const groupedServices = groupByServiceGroup(services);

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
      {groupedServices && groupedServices.length === 0 && (
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
      {groupedServices &&
        groupedServices.length > 0 &&
        groupedServices.map((g) => {
          if (g.group) {
            return (
              <div key={g.group.id} className="w-full px-1 pt-1 pb-1">
                <div className="flex w-full flex-col rounded-xl border bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,_var(--border)_30%,_transparent)_0px,color-mix(in_oklab,_var(--border)_30%,_transparent)_2px,transparent_2px,transparent_6px)] p-1">
                  <div className="flex w-full items-center gap-2 px-3 pt-2 pb-2.5 leading-tight font-semibold">
                    <ServiceIcon variant={g.group.type} className="size-6" />
                    <p className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap">
                      {g.group.title}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-start">
                    {g.services.map((s) => (
                      <ServiceCard
                        key={s.id}
                        service={s}
                        className="w-full sm:w-1/2 lg:w-1/3"
                        classNameCard="rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return g.services.map((s) => (
            <ServiceCard key={s.id} service={s} className="w-full sm:w-1/2 lg:w-1/3" />
          ));
        })}
    </ol>
  );
}
