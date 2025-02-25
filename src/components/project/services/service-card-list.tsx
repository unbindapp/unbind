"use client";

import {
  commandPanelKey,
  commandPanelPageKey,
  commandPanelProjectFromList,
  commandPanelProjectRootPage,
} from "@/components/command-panel/constants";
import { ProjectCommandPanelTrigger } from "@/components/command-panel/project/project-command-panel";
import ServiceIcon from "@/components/icons/service";
import ServiceCard from "@/components/project/services/service-card";
import { Button } from "@/components/ui/button";
import { groupByServiceGroup } from "@/lib/helpers";
import { api } from "@/server/trpc/setup/client";
import { PlusIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useRef } from "react";

type Props = {
  teamId: string;
  projectId: string;
  environmentId: string;
};

export default function ServiceCardList({
  teamId,
  projectId,
  environmentId,
}: Props) {
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
    parseAsString.withDefault(commandPanelProjectRootPage)
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
    <ol className="w-full flex flex-wrap">
      {groupedServices && groupedServices.length === 0 && (
        <li className="w-full flex flex-col p-1 sm:w-1/2 lg:w-1/3">
          <ProjectCommandPanelTrigger
            open={open}
            setOpen={setOpen}
            teamId={teamId}
            projectId={projectId}
          >
            <Button
              variant="ghost"
              className="w-full text-muted-foreground font-medium text-center flex justify-center items-center min-h-36 border rounded-xl px-5 py-3.5"
            >
              <PlusIcon className="size-5 -ml-1.5 shrink-0" />
              <p className="shrink min-w-0 leading-tight">New Service</p>
            </Button>
          </ProjectCommandPanelTrigger>
        </li>
      )}
      {groupedServices &&
        groupedServices.length > 0 &&
        groupedServices.map((g) => {
          if (g.group) {
            return (
              <div key={g.group.id} className="w-full px-1 pb-1 pt-1">
                <div
                  className="w-full flex flex-col rounded-xl border p-1 
                  bg-[repeating-linear-gradient(135deg,hsl(var(--border)/0.3)_0px,hsl(var(--border)/0.3)_2px,transparent_2px,transparent_6px)]"
                >
                  <div className="w-full px-3 pt-2 pb-2.5 leading-tight font-semibold flex items-center gap-2">
                    <ServiceIcon variant={g.group.type} className="size-6" />
                    <p className="shrink min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
                      {g.group.title}
                    </p>
                  </div>
                  <div className="w-full flex justify-start items-center flex-wrap">
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
            <ServiceCard
              key={s.id}
              service={s}
              className="w-full sm:w-1/2 lg:w-1/3"
            />
          ));
        })}
    </ol>
  );
}
