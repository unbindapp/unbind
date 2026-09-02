"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
import ServiceCard from "@/components/service/service-card";
import PendingServiceCard from "@/components/service/pending-service-card";
import ServiceGroupCard from "@/components/service/service-group-card";
import { useServices } from "@/components/service/services-provider";
import TemplateDraftCard from "@/components/templates/template-draft-card";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { useTemplateDraftStore } from "@/components/templates/template-draft-store-provider";
import { TPendingService } from "@/components/stores/pending/pending-entity-store";
import { usePendingEntityStore } from "@/components/stores/pending/pending-entity-store-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/lib/queries/services";
import { PlusIcon } from "lucide-react";
import { ReactNode, useMemo } from "react";

const placeholderArray = Array.from({ length: 6 });

export default function ServiceCardList() {
  const {
    query: { data, isPending, error },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const services = data?.services;

  const servicesOrGroups = useMemo(() => {
    if (!services) return undefined;
    const items: TServiceOrServiceGroup[] = [];

    for (const service of services) {
      if (service.service_group) {
        const currentGroup = service.service_group;
        const existingGroupIndex = items.findIndex(
          (item) => item.type === "service-group" && item.group.id === currentGroup.id,
        );
        if (existingGroupIndex === -1) {
          items.push({
            type: "service-group",
            group: currentGroup,
            services: [service],
          });
          continue;
        }
        items[existingGroupIndex].services?.push(service);
        continue;
      }
      items.push({ type: "service", service });
    }

    return items;
  }, [services]);

  const templateDrafts = useTemplateDraftStore((s) => s.templateDrafts);
  const pendingServices = usePendingEntityStore((s) => s.pendingServices);

  const servicesOrTemplateDrafts = useMemo(() => {
    const isInEnvironment = (item: { teamId: string; projectId: string; environmentId: string }) =>
      item.teamId === teamId &&
      item.projectId === projectId &&
      item.environmentId === environmentId;

    const allItems: TServiceOrTemplateDraft[] = [
      ...pendingServices
        .filter(isInEnvironment)
        .map((p) => ({ type: "pending-service", obj: p }) as const),
      ...templateDrafts
        .filter(isInEnvironment)
        .map((t) => ({ type: "template-draft", obj: t }) as const),
      ...(servicesOrGroups || []).map((s) => ({ type: "service", obj: s }) as const),
    ];

    return allItems.toSorted(
      (a, b) => new Date(getCreatedAt(b)).getTime() - new Date(getCreatedAt(a)).getTime(),
    );
  }, [pendingServices, templateDrafts, servicesOrGroups, teamId, projectId, environmentId]);

  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-service", teamId, projectId, environmentId }),
    [teamId, projectId, environmentId],
  );

  if (!servicesOrGroups && !isPending && error) {
    return (
      <Wrapper>
        <li className="w-full p-1">
          <ErrorCard message={error.message} />
        </li>
      </Wrapper>
    );
  }

  if (!servicesOrGroups || isPending) {
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
      {servicesOrTemplateDrafts.map((item) =>
        item.type === "pending-service" ? (
          <PendingServiceCard
            key={item.obj.id}
            pendingService={item.obj}
            className="w-full sm:w-1/2 lg:w-1/3"
          />
        ) : item.type === "template-draft" ? (
          <TemplateDraftCard
            data-hidden={item.obj.hidden}
            key={item.obj.id}
            templateDraft={item.obj}
            className="w-full data-hidden:hidden sm:w-1/2 lg:w-1/3"
          />
        ) : item.obj.type === "service-group" ? (
          <ServiceGroupCard
            data-count={item.obj.services.length}
            key={item.obj.group.id}
            groupObject={item.obj}
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            className="group/service-group w-full"
            classNameServiceCard="w-full sm:w-1/2 lg:w-1/3"
          />
        ) : (
          <ServiceCard
            key={item.obj.service.id}
            service={item.obj.service}
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            className="w-full sm:w-1/2 lg:w-1/3"
          />
        ),
      )}

      {services && services.length < 3 && (
        <li className="flex w-full flex-col p-1 sm:w-1/2 lg:w-1/3">
          <ContextCommandPanel
            title="Create New Service"
            description="Create a new service on Unbind"
            context={context}
            triggerType="list"
          >
            <Button
              variant="card"
              className="bg-background text-muted-foreground flex min-h-38 w-full items-center justify-center rounded-xl border px-5 py-3.5 text-center font-medium"
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

export type TServiceGroup = {
  group: NonNullable<TServiceShallow["service_group"]>;
  services: TServiceShallow[];
};

type TServiceOrServiceGroup =
  | { type: "service"; service: TServiceShallow; group?: never; services?: never }
  | ({
      type: "service-group";
      service?: never;
    } & TServiceGroup);

type TServiceOrTemplateDraft =
  | { type: "pending-service"; obj: TPendingService }
  | { type: "template-draft"; obj: TTemplateDraft }
  | { type: "service"; obj: TServiceOrServiceGroup };

function getCreatedAt(item: TServiceOrTemplateDraft) {
  if (item.type === "pending-service" || item.type === "template-draft") return item.obj.createdAt;
  if (item.obj.type === "service-group") return item.obj.group.created_at;
  return item.obj.service.created_at;
}
