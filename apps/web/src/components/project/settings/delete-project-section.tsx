"use client";

import { useProject } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import DeleteCard from "@/components/settings/delete-card";
import { deleteProject as deleteProjectFn } from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

type Props = {
  className?: string;
};

export default function DeleteProjectSection({ className }: Props) {
  const {
    teamId,
    projectId,
    query: { data },
  } = useProject();
  const { invalidate } = useProjectsUtils({ teamId });

  const {
    mutateAsync: deleteProject,
    error,
    reset,
  } = useMutation({
    mutationFn: deleteProjectFn,
    onSuccess: () => {
      invalidate();
    },
  });

  const router = useRouter();

  return (
    <DeleteCard
      dialogTitle="Delete Project"
      dialogDescription="Are you sure you want to delete this project? This action cannot be undone. All environments, services, and data inside this project will be permanently deleted."
      paragraph="This action cannot be undone. All environments, services, and data inside this project will be permanently deleted."
      buttonText="Delete Project"
      error={error}
      deletingEntityName={data?.project?.name || "the project"}
      onDialogClose={reset}
      onSubmit={async () => {
        await deleteProject({ teamId, projectId });
        await router.navigate({ to: "/$team_id", params: { team_id: teamId } });
      }}
      className={className}
    />
  );
}
