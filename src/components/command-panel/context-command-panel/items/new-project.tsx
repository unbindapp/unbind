import { useCommandPanelState } from "@/components/command-panel/command-panel-state-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { api } from "@/server/trpc/setup/client";
import { FolderPlusIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

export default function useNewProjectItem({ context }: TProps) {
  const { setIsPendingId } = useCommandPanelState();
  const { asyncPush } = useAsyncPush();
  const { invalidate: invalidateProjects } = useProjectsUtils({ teamId: context.teamId });

  const { mutate: createProject } = api.projects.create.useMutation({
    onSuccess: async (res) => {
      const projectId = res.data?.id;
      const environments = res.data.environments;
      if (environments.length < 1) {
        throw new Error("No environment found");
      }
      const environmentId = environments[0].id;
      if (!projectId || !environmentId) {
        throw new Error("Project or environment ID not found");
      }
      await invalidateProjects();
      await asyncPush(`/${context.teamId}/project/${projectId}?environment=${environmentId}`);
    },
    onSettled: () => {
      setIsPendingId(null);
    },
  });

  const item: TCommandPanelItem = useMemo(() => {
    return {
      id: "new-project",
      title: "New Project",
      keywords: ["New Project", "Create project...", "Creating project..."],
      onSelect: (props) => {
        if (props?.isPendingId === "new-project") return;
        setIsPendingId("new-project");
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
