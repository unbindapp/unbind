import { flattenBlocks, toBlocks, type TServiceBlock } from "@/components/service/service-blocks";
import ServiceCard from "@/components/service/service-card";
import ServiceGroupCard from "@/components/service/service-group-card";
import type { TServicesResult } from "@/components/service/services-context";
import SortableServiceCard from "@/components/service/sortable-service-card";
import {
  blockClickAfterDrag,
  closestInSameList,
  keepInPlace,
  releaseClickAfterDrag,
  useCardSensors,
} from "@/components/sortable/card-sorting";
import { toast } from "@/components/ui/toast";
import { queryKeyServices, reorderServiceGroup, reorderServices } from "@/lib/queries/services";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type TScope = { teamId: string; projectId: string; environmentId: string };

type TProps = TScope & {
  blocks: TServiceBlock[];
  disabled: boolean;
};

const topLevelId = "services";
const serviceClassName = "w-full sm:w-1/2 lg:w-1/3";

export default function SortableServiceBlocks({ blocks, disabled, ...scope }: TProps) {
  const reorder = useReorderServices(scope);
  const sensors = useCardSensors();
  // While dragging, the list shows where the item would land and the page lays it out,
  // since groups and services differ in size. After the drop it stays until the reorder
  // reaches the query cache, a tick later.
  const [preview, setPreview] = useState<{ blocks: TServiceBlock[]; of: TServiceBlock[] } | null>(
    null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  if (preview && !activeId && preview.of !== blocks) setPreview(null);
  const shown = preview?.blocks ?? blocks;

  const onDragStart = ({ active }: DragStartEvent) => {
    blockClickAfterDrag();
    setActiveId(String(active.id));
    setPreview({ blocks, of: blocks });
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return;
    const list = active.data.current?.sortable?.containerId;
    setPreview((current) =>
      current
        ? {
            ...current,
            blocks: moveInList(current.blocks, list, String(active.id), String(over.id)),
          }
        : current,
    );
  };

  const onDragEnd = ({ active }: DragEndEvent) => {
    releaseClickAfterDrag();
    const list = active.data.current?.sortable?.containerId;
    if (preview) commit(list, preview.blocks);
    setPreview((current) => (current ? { ...current, of: blocks } : current));
    setActiveId(null);
  };

  const onDragCancel = () => {
    releaseClickAfterDrag();
    setPreview(null);
    setActiveId(null);
  };

  const commit = (list: unknown, arranged: TServiceBlock[]) => {
    if (list === topLevelId) {
      const ids = arranged.map((b) => b.id);
      if (ids.join() !== blocks.map((b) => b.id).join()) reorder.environment(ids);
      return;
    }
    const group = findGroup(arranged, list);
    const before = findGroup(blocks, list);
    if (!group || !before) return;
    const ids = group.services.map((s) => s.id);
    if (ids.join() !== before.services.map((s) => s.id).join()) reorder.group(group.id, ids);
  };

  const active = activeId ? findActive(shown, activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestInSameList}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext
        id={topLevelId}
        items={shown.map((b) => b.id)}
        strategy={keepInPlace}
        disabled={disabled}
      >
        {shown.map((block) =>
          block.type === "service" ? (
            <SortableServiceCard
              key={block.id}
              service={block.service}
              disabled={disabled}
              {...scope}
              className={serviceClassName}
            />
          ) : (
            <SortableServiceGroup key={block.id} block={block} disabled={disabled} {...scope} />
          ),
        )}
      </SortableContext>
      <DragOverlay>
        {active?.type === "service" && (
          <ServiceCard service={active.service} {...scope} isDragging className="h-full" />
        )}
        {active?.type === "service-group" && (
          <ServiceGroupCard
            groupObject={active}
            {...scope}
            isDragging
            asOverlay
            sortDisabled
            className="h-full"
            classNameServiceCard={serviceClassName}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function findGroup(blocks: TServiceBlock[], id: unknown) {
  const block = blocks.find((b) => b.id === id);
  return block?.type === "service-group" ? block : undefined;
}

function findActive(blocks: TServiceBlock[], id: string) {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.type !== "service-group") continue;
    const service = block.services.find((s) => s.id === id);
    if (service) return { type: "service" as const, id, service };
  }
  return null;
}

function moveInList(blocks: TServiceBlock[], list: unknown, activeId: string, overId: string) {
  if (list === topLevelId) {
    const ids = blocks.map((b) => b.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    return from < 0 || to < 0 ? blocks : arrayMove(blocks, from, to);
  }
  return blocks.map((b) => {
    if (b.type !== "service-group" || b.id !== list) return b;
    const ids = b.services.map((s) => s.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    return from < 0 || to < 0 ? b : { ...b, services: arrayMove(b.services, from, to) };
  });
}

function SortableServiceGroup({
  block,
  disabled,
  ...scope
}: TScope & { block: Extract<TServiceBlock, { type: "service-group" }>; disabled: boolean }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled,
  });

  return (
    <ServiceGroupCard
      groupObject={block}
      {...scope}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragListeners={disabled ? undefined : listeners}
      isDragSource={isDragging}
      sortDisabled={disabled}
      className="group/service-group w-full"
      classNameServiceCard={serviceClassName}
    />
  );
}

function useReorderServices(scope: TScope) {
  const queryClient = useQueryClient();
  const queryKey = queryKeyServices.list(scope);
  const mutationKey = ["reorder-services", scope.environmentId];

  const { mutate } = useMutation({
    mutationKey,
    // Requests go out one at a time so the last drag is the one the server keeps
    scope: { id: `reorder-services-${scope.environmentId}` },
    mutationFn: (
      change:
        | { type: "environment"; ids: string[] }
        | { type: "group"; groupId: string; ids: string[] },
    ) =>
      change.type === "environment"
        ? reorderServices({ ...scope, ids: change.ids })
        : reorderServiceGroup({ ...scope, serviceGroupId: change.groupId, serviceIds: change.ids }),
    onSuccess: (data) => {
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      queryClient.setQueryData<TServicesResult>(queryKey, data);
    },
    onError: (error) => {
      toast.add({ type: "error", title: "Failed to reorder services", description: error.message });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const update = (arrange: (blocks: TServiceBlock[]) => TServiceBlock[]) => {
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<TServicesResult>(queryKey, (old) =>
      old ? { ...old, services: flattenBlocks(arrange(toBlocks(old.services))) } : old,
    );
  };

  return {
    environment: (ids: string[]) => {
      update((blocks) => {
        const byId = new Map(blocks.map((b) => [b.id, b]));
        return ids.flatMap((id) => byId.get(id) ?? []);
      });
      mutate({ type: "environment", ids });
    },
    group: (groupId: string, ids: string[]) => {
      update((blocks) =>
        blocks.map((b) => {
          if (b.type !== "service-group" || b.id !== groupId) return b;
          const byId = new Map(b.services.map((s) => [s.id, s]));
          return { ...b, services: ids.flatMap((id) => byId.get(id) ?? []) };
        }),
      );
      mutate({ type: "group", groupId, ids });
    },
  };
}
