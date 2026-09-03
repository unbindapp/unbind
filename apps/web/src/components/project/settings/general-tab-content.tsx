"use client";

import { useProject } from "@/components/project/project-provider";
import { useProjects } from "@/components/project/projects-provider";
import RenameCard from "@/components/settings/rename-card";
import { cn } from "@/components/ui/utils";
import {
  projectDescriptionMaxLength,
  projectNameMaxLength,
  ProjectUpdateFormSchema,
  updateProject as updateProjectFn,
} from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";

type TProps = {
  projectId: string;
  teamId: string;
  className?: string;
};

export default function GeneralTabContent({ teamId, projectId, className }: TProps) {
  const {
    query: { data, refetch: refetchProject },
  } = useProject();
  const { refetch: refetchProjects } = useProjects();

  const { mutateAsync: updateProject, error } = useMutation({ mutationFn: updateProjectFn });

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <RenameCard
        type="project"
        onSubmit={async (value) => {
          await updateProject({
            description: value.description || "",
            name: value.name,
            projectId,
            teamId,
          });
          await Promise.all([refetchProject(), refetchProjects()]);
        }}
        name={data?.project.name}
        description={data?.project.description}
        nameMaxLength={projectNameMaxLength}
        descriptionMaxLength={projectDescriptionMaxLength}
        error={error}
        schema={ProjectUpdateFormSchema}
      />
    </div>
  );
}
