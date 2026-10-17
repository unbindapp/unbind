import type { TProjectsResult } from "@/components/project/projects-provider";
import ProjectCard from "@/components/team/project-card";
import { toast } from "@/components/ui/toast";
import { queryKeyProjects, reorderProjects, type TProjectShallow } from "@/lib/queries/projects";
import {
  blockClickAfterDrag,
  releaseClickAfterDrag,
  useCardSensors,
} from "@/components/sortable/card-sorting";
import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type TProps = {
  teamId: string;
  projects: TProjectShallow[];
  disabled: boolean;
  className?: string;
};

export default function SortableProjectCards({ teamId, projects, disabled, className }: TProps) {
  const reorder = useReorderProjects(teamId);
  const sensors = useCardSensors();
  const ids = projects.map((p) => p.id);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    releaseClickAfterDrag();
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={blockClickAfterDrag}
      onDragEnd={onDragEnd}
      onDragCancel={releaseClickAfterDrag}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy} disabled={disabled}>
        {projects.map((project) => (
          <SortableProjectCard
            key={project.id}
            project={project}
            disabled={disabled}
            className={className}
          />
        ))}
      </SortableContext>
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
      isDragging={isDragging}
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
