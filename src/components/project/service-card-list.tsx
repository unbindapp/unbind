"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
import ServiceCard from "@/components/project/service-card";
import { useServices } from "@/components/project/services-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { PlusIcon } from "lucide-react";
import { ReactNode, useMemo } from "react";

const placeholderArray = Array.from({ length: 3 });

export default function ServiceCardList() {
  const {
    query: { data, isPending, error },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const services = data?.services;

  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-service", teamId, projectId, environmentId }),
    [teamId, projectId, environmentId],
  );

  if (!services && !isPending && error) {
    return (
      <Wrapper>
        <li className="w-full p-1">
          <ErrorCard message={error.message} />
        </li>
      </Wrapper>
    );
  }

  if (!services || isPending) {
    return (
      <Wrapper>
        {placeholderArray.map((_, index) => (
          <ServiceCard key={index} isPlaceholder className="w-full md:w-1/2 lg:w-1/3" />
        ))}
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {services.map((s) => (
        <ServiceCard
          key={s.id}
          service={s}
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
          className="w-full sm:w-1/2 lg:w-1/3"
        />
      ))}
      {services.length < 3 && (
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
    </Wrapper>
  );
}

function Wrapper({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("flex w-full flex-wrap", className)}>{children}</ol>;
}
