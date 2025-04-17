"use client";

import { useProject } from "@/components/project/project-provider";
import { useProjects } from "@/components/project/projects-provider";
import RenameCard from "@/components/settings/rename-card";
import {
  projectDescriptionMaxLength,
  projectNameMaxLength,
  ProjectUpdateFormSchema,
} from "@/server/trpc/api/projects/types";
import { api } from "@/server/trpc/setup/client";

type TProps = {
  projectId: string;
  teamId: string;
};

export default function GeneralTabContent({ teamId, projectId }: TProps) {
  const {
    query: { data, refetch: refetchProject },
  } = useProject();
  const { refetch: refetchProjects } = useProjects();

  const { mutateAsync: updateProject, error } = api.projects.update.useMutation();

  return (
    <div className="flex w-full flex-col gap-3">
      <RenameCard
        type="project"
        onSubmit={async (value) => {
          await updateProject({
            description: value.description || "",
            displayName: value.displayName,
            projectId,
            teamId,
          });
          await Promise.all([refetchProject(), refetchProjects()]);
        }}
        displayName={data?.project.display_name}
        description={data?.project.description}
        displayNameMaxLength={projectNameMaxLength}
        descriptionMaxLength={projectDescriptionMaxLength}
        error={error}
        schema={ProjectUpdateFormSchema}
      />
    </div>
  );
}
