import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { createProject as createProjectFn } from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { FolderPlusIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export default function useNewProjectItem({ context }: TProps) {
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const router = useRouter();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId: context.teamId });
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const { mutate: createProject } = useMutation({
    mutationFn: createProjectFn,
    onSuccess: async (res) => {
      const projectId = res.data.id;
      temporarilyAddNewEntity(res.data.id);

      const environments = res.data.environments;
      if (environments.length < 1) {
        toast.error("No environments found", {
          description: "There is no environment in this project",
        });
        setIsPendingId(null);
        return;
      }
      const environmentId = res.data.default_environment_id || environments[0].id;
      if (!projectId || !environmentId) {
        toast.error("Project or environment ID is missing", {
          description: "Project ID or Environment ID is missing",
        });
        setIsPendingId(null);
        return;
      }

      const invalidateRes = await ResultAsync.fromPromise(
        invalidateProjects(),
        () => new Error("Failed to invalidate projects"),
      );
      if (invalidateRes.isErr()) {
        toast.error("Failed to invalidate projects", {
          description: invalidateRes.error.message,
        });
        setIsPendingId(null);
        return;
      }

      const navigateRes = await ResultAsync.fromPromise(
        router.navigate({
          to: "/$team_id/project/$project_id",
          params: { team_id: context.teamId, project_id: projectId },
          search: { environment: environmentId },
        }),
        () => new Error("Failed to navigate to project"),
      );
      if (navigateRes.isErr()) {
        toast.error("Failed to navigate to project", {
          description: navigateRes.error.message,
        });
        setIsPendingId(null);
        return;
      }

      closePanel();
      setIsPendingId(null);
    },
    onError: (error) => {
      toast.error("Failed to create project", {
        description: error.message,
      });
      setIsPendingId(null);
    },
  });

  const item: TCommandPanelItem = useMemo(() => {
    const id = `new-project`;
    return {
      id,
      title: "New Project",
      keywords: ["New Project", "Create project...", "Creating project..."],
      onSelect: (props) => {
        if (props?.isPendingId === id) return;
        setIsPendingId(id);
        createProject({ teamId: context.teamId });
      },
      Icon: FolderPlusIcon,
    };
  }, [setIsPendingId, createProject, context.teamId]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
