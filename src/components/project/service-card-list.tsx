"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import ServiceCard from "@/components/project/service-card";
import { useServices } from "@/components/project/services-provider";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useMemo } from "react";

export default function ServiceCardList() {
  const {
    query: { data },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const services = data?.services;

  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-service", teamId, projectId, environmentId }),
    [teamId, projectId, environmentId],
  );

  return (
    <ol className="flex w-full flex-wrap">
      {services && services.length === 0 && (
        <li className="flex w-full flex-col p-1 sm:w-1/2 lg:w-1/3">
          <ContextCommandPanel
            title="Create New Service"
            description="Create a new service on Unbind"
            context={context}
            triggerType="list"
          >
            <Button
              variant="ghost"
              className="text-muted-foreground flex min-h-36 w-full items-center justify-center rounded-xl border px-5 py-3.5 text-center font-medium"
            >
              <PlusIcon className="-ml-1.5 size-5 shrink-0" />
              <p className="min-w-0 shrink leading-tight">New Service</p>
            </Button>
          </ContextCommandPanel>
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
