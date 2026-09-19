import { useProjectsUtils } from "@/components/project/projects-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { createProject } from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

type TProps = {
  teamId: string;
  onBeforeNavigate?: () => Promise<void>;
};

export function useCreateAndOpenProject({ teamId, onBeforeNavigate }: TProps) {
  const router = useRouter();
  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId });

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: project } = await createProject({ teamId, name });
      const environmentId = project.default_environment_id || project.environments[0]?.id;
      if (!environmentId) throw new Error("There is no environment in the new project");

      temporarilyAddNewEntity(project.id);
      await invalidateProjects();
      await onBeforeNavigate?.();
      await router.navigate({
        to: "/$team_id/project/$project_id",
        params: { team_id: teamId, project_id: project.id },
        search: { environment: environmentId },
      });
    },
  });
}
