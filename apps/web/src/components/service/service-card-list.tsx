"use client";

import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { useProject } from "@/components/project/project-provider";
import ServiceCard from "@/components/service/service-card";
import PendingServiceCard from "@/components/service/pending-service-card";
import { filterAndSortBlocks, toBlocks } from "@/components/service/service-blocks";
import { useServices } from "@/components/service/services-provider";
import SortableServiceBlocks from "@/components/service/sortable-service-blocks";
import TemplateDraftCard from "@/components/templates/template-draft-card";
import { useTemplateDraftStore } from "@/components/templates/template-draft-store-provider";
import { usePendingEntityStore } from "@/components/stores/pending/pending-entity-store-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { defaultListSort, type TListSort } from "@/lib/list-sort";
import { PlusIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { ReactNode, useMemo } from "react";

type TProps = {
  search: string;
  sort: TListSort;
  onClearSearch: () => void;
};

const placeholderArray = Array.from({ length: 6 });

export default function ServiceCardList({ search, sort, onClearSearch }: TProps) {
  const {
    query: { data, isPending, error },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const {
    query: { data: projectData },
  } = useProject();
  const services = data?.services;
  const isSearching = search.trim() !== "";

  const blocks = useMemo(
    () => (services ? filterAndSortBlocks(toBlocks(services), search, sort) : undefined),
    [services, search, sort],
  );

  const canEditEnvironment =
    projectData?.project.environments
      .find((e) => e.id === environmentId)
      ?.permissions.includes("editor") ?? false;
  const canReorder = sort === defaultListSort && !isSearching && canEditEnvironment;

  const templateDrafts = useTemplateDraftStore((s) => s.templateDrafts);
  const pendingServices = usePendingEntityStore((s) => s.pendingServices);

  // Services and templates on their way in go first, newest on top
  const incoming = useMemo(() => {
    const deployedInstanceIds = new Set(services?.map((s) => s.template_instance_id));
    const isInEnvironment = (item: { teamId: string; projectId: string; environmentId: string }) =>
      item.teamId === teamId &&
      item.projectId === projectId &&
      item.environmentId === environmentId;

    return [
      ...pendingServices
        .filter(isInEnvironment)
        .map((p) => ({ type: "pending-service", obj: p }) as const),
      ...templateDrafts
        .filter((t) => isInEnvironment(t) && !deployedInstanceIds.has(t.id))
        .map((t) => ({ type: "template-draft", obj: t }) as const),
    ].toSorted((a, b) => new Date(b.obj.createdAt).getTime() - new Date(a.obj.createdAt).getTime());
  }, [pendingServices, templateDrafts, services, teamId, projectId, environmentId]);

  const context: TContextCommandPanelContext = useMemo(
    () => ({ contextType: "new-service", teamId, projectId, environmentId }),
    [teamId, projectId, environmentId],
  );

  if (!blocks && !isPending && error) {
    return (
      <Wrapper>
        <li className="w-full p-1">
          <ErrorCard message={error.message} />
        </li>
      </Wrapper>
    );
  }

  if (!blocks || isPending) {
    return (
      <Wrapper>
        {placeholderArray.map((_, index) => (
          <ServiceCard key={index} isPlaceholder className="w-full md:w-1/2 lg:w-1/3" />
        ))}
      </Wrapper>
    );
  }

  if (isSearching && blocks.length === 0) {
    return (
      <Wrapper>
        <li className="w-full p-1">
          <NoItemsCard Icon={SearchIcon}>
            <p className="w-full max-w-lg leading-tight">No services match the current search</p>
            <Button className="mt-2" onClick={onClearSearch}>
              <RotateCcwIcon className="-ml-1 size-5 shrink-0" />
              <p className="min-w-0 shrink">Clear Search</p>
            </Button>
          </NoItemsCard>
        </li>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      {!isSearching &&
        incoming.map((item) =>
          item.type === "pending-service" ? (
            <PendingServiceCard
              key={item.obj.id}
              pendingService={item.obj}
              className="w-full sm:w-1/2 lg:w-1/3"
            />
          ) : (
            <TemplateDraftCard
              data-hidden={item.obj.hidden}
              key={item.obj.id}
              templateDraft={item.obj}
              className="w-full data-hidden:hidden sm:w-1/2 lg:w-1/3"
            />
          ),
        )}

      <SortableServiceBlocks
        blocks={blocks}
        disabled={!canReorder}
        teamId={teamId}
        projectId={projectId}
        environmentId={environmentId}
      />

      {!isSearching && services && services.length < 3 && (
        <li className="flex w-full flex-col p-1 sm:w-1/2 lg:w-1/3">
          <ContextCommandPanel
            title="Add Service"
            description="Add a service on Unbind"
            context={context}
            triggerType="list"
          >
            <Button
              variant="card"
              className="bg-background text-muted-foreground flex min-h-38 w-full items-center justify-center rounded-xl border px-5 py-3.5 text-center font-medium"
            >
              <PlusIcon className="-ml-1.5 size-5 shrink-0" />
              <p className="min-w-0 shrink leading-tight">Add</p>
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
