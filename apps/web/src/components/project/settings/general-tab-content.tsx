"use client";

import { useProject } from "@/components/project/project-provider";
import { useProjects } from "@/components/project/projects-provider";
import RenameCard from "@/components/settings/rename-card";
import {
  projectDescriptionMaxLength,
  projectNameMaxLength,
  ProjectUpdateFormSchema,
} from "@/server/types/projects";
import { updateProject as updateProjectFn } from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";

type TProps = {
  projectId: string;
  teamId: string;
};

export default function GeneralTabContent({ teamId, projectId }: TProps) {
  const {
    query: { data, refetch: refetchProject },
  } = useProject();
  const { refetch: refetchProjects } = useProjects();

  const { mutateAsync: updateProject, error } = useMutation({ mutationFn: updateProjectFn });

  return (
    <div className="flex w-full flex-col gap-3">
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
