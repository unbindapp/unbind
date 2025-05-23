"use client";

import { useProject } from "@/components/project/project-provider";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import DeleteCard from "@/components/settings/delete-card";
import { api } from "@/server/trpc/setup/client";

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
  } = api.projects.delete.useMutation({
    onSuccess: () => {
      invalidate();
    },
  });

  const { asyncPush } = useAsyncPush();

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
        await asyncPush(`/${teamId}`);
      }}
      className={className}
    />
  );
}
