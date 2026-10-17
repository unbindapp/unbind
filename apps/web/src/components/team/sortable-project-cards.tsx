import type { TProjectsResult } from "@/components/project/projects-provider";
import ProjectCard from "@/components/team/project-card";
import { toast } from "@/components/ui/toast";
import { queryKeyProjects, reorderProjects, type TProjectShallow } from "@/lib/queries/projects";
import {
  blockClickAfterDrag,
  closestInSameList,
  keepInPlace,
  releaseClickAfterDrag,
  useCardSensors,
} from "@/components/sortable/card-sorting";
import { DndContext, DragOverlay, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type TProps = {
  teamId: string;
  projects: TProjectShallow[];
  disabled: boolean;
  className?: string;
};

export default function SortableProjectCards({ teamId, projects, disabled, className }: TProps) {
  const reorder = useReorderProjects(teamId);
  const sensors = useCardSensors();
  // While dragging, the list shows where the card would land. After the drop it stays until
  // the reorder reaches the query cache, a tick later.
  const [preview, setPreview] = useState<{
    projects: TProjectShallow[];
    of: TProjectShallow[];
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  if (preview && !activeId && preview.of !== projects) setPreview(null);
  const shown = preview?.projects ?? projects;

  const onDragStart = ({ active }: DragStartEvent) => {
    blockClickAfterDrag();
    setActiveId(String(active.id));
    setPreview({ projects, of: projects });
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return;
    setPreview((current) => {
      if (!current) return current;
      const ids = current.projects.map((p) => p.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return current;
      return { ...current, projects: arrayMove(current.projects, from, to) };
    });
  };

  const onDragEnd = () => {
    releaseClickAfterDrag();
    const ids = preview?.projects.map((p) => p.id);
    if (ids && ids.join() !== projects.map((p) => p.id).join()) reorder(ids);
    setPreview((current) => (current ? { ...current, of: projects } : current));
    setActiveId(null);
  };

  const onDragCancel = () => {
    releaseClickAfterDrag();
    setPreview(null);
    setActiveId(null);
  };

  const active = activeId ? shown.find((p) => p.id === activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestInSameList}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={shown.map((p) => p.id)} strategy={keepInPlace} disabled={disabled}>
        {shown.map((project) => (
          <SortableProjectCard
            key={project.id}
            project={project}
            disabled={disabled}
            className={className}
          />
        ))}
      </SortableContext>
      <DragOverlay>
        {active && <ProjectCard project={active} isDragging className="h-full" />}
      </DragOverlay>
    </DndContext>
  );
}

function SortableProjectCard({
  project,
  disabled,
  className,
}: {
  project: TProjectShallow;
  disabled: boolean;
  className?: string;
}) {
  // The list itself reorders while dragging, the transform only animates the card to its new place
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled,
  });

  return (
    <ProjectCard
      project={project}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragListeners={disabled ? undefined : listeners}
      isDragSource={isDragging}
      className={className}
    />
  );
}

function useReorderProjects(teamId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeyProjects.list({ teamId });
  const mutationKey = ["reorder-projects", teamId];

  const { mutate } = useMutation({
    mutationKey,
    // Requests go out one at a time so the last drag is the one the server keeps
    scope: { id: `reorder-projects-${teamId}` },
    mutationFn: (projectIds: string[]) => reorderProjects({ teamId, projectIds }),
    onSuccess: (data) => {
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      queryClient.setQueryData<TProjectsResult>(queryKey, data);
    },
    onError: (error) => {
      toast.add({ type: "error", title: "Failed to reorder projects", description: error.message });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return (projectIds: string[]) => {
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<TProjectsResult>(queryKey, (old) => {
      if (!old) return old;
      const byId = new Map(old.projects.map((p) => [p.id, p]));
      return { projects: projectIds.flatMap((id) => byId.get(id) ?? []) };
    });
    mutate(projectIds);
  };
}
