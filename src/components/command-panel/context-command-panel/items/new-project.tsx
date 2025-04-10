import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { api } from "@/server/trpc/setup/client";
import { FolderPlusIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  context: TContextCommandPanelContext;
};

export default function useNewProjectItem({ context }: TProps) {
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { asyncPush } = useAsyncPush();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId: context.teamId });
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const { mutate: createProject } = api.projects.create.useMutation({
    onSuccess: async (res) => {
      const projectId = res.data?.id;
      const environments = res.data.environments;
      if (environments.length < 1) {
        toast.error("No environments found", {
          description: "There is no environment in this project",
        });
        setIsPendingId(null);
        return;
      }
      const environmentId = environments[0].id;
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

      const asyncPushRes = await ResultAsync.fromPromise(
        asyncPush(`/${context.teamId}/project/${projectId}?environment=${environmentId}`),
        () => new Error("Failed to navigate to project"),
      );
      if (asyncPushRes.isErr()) {
        toast.error("Failed to navigate to project", {
          description: asyncPushRes.error.message,
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
