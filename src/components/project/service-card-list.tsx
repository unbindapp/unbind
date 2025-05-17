"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
import ServiceCard from "@/components/project/service-card";
import ServiceGroupCard from "@/components/project/service-group-card";
import { useServices } from "@/components/project/services-provider";
import TemplateDraftCard from "@/components/templates/template-draft-card";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { useTemplateDraftStore } from "@/components/templates/template-draft-store-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";
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

  const servicesOrTemplateDrafts = useMemo(() => {
    const allItems: TServiceOrTemplateDraft[] = [
      ...templateDrafts
        .filter(
          (t) =>
            t.teamId === teamId && t.projectId === projectId && t.environmentId === environmentId,
        )
        .map((t) => ({ type: "template-draft", obj: t }) as const),
      ...(servicesOrGroups || []).map((s) => ({ type: "service", obj: s }) as const),
    ];

    return allItems.sort((a, b) => {
      const aTimestamp = new Date(
        a.type === "template-draft"
          ? a.obj.createdAt
          : a.obj.type === "service-group"
            ? a.obj.group.created_at
            : a.obj.service.created_at,
      ).getTime();
      const bTimestamp = new Date(
        b.type === "template-draft"
          ? b.obj.createdAt
          : b.obj.type === "service-group"
            ? b.obj.group.created_at
            : b.obj.service.created_at,
      ).getTime();
      return bTimestamp - aTimestamp;
    });
  }, [templateDrafts, servicesOrGroups, teamId, projectId, environmentId]);

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
        item.type === "template-draft" ? (
          <TemplateDraftCard
            key={item.obj.id}
            templateDraft={item.obj}
            className="w-full sm:w-1/2 lg:w-1/3"
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
  | { type: "template-draft"; obj: TTemplateDraft }
  | { type: "service"; obj: TServiceOrServiceGroup };
