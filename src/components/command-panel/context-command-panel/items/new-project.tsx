import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { api } from "@/server/trpc/setup/client";
import { FolderPlusIcon } from "lucide-react";
import { useMemo } from "react";

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
        throw new Error("No environment found");
      }
      const environmentId = environments[0].id;
      if (!projectId || !environmentId) {
        throw new Error("Project or environment ID not found");
      }
      await invalidateProjects();
      await asyncPush(`/${context.teamId}/project/${projectId}?environment=${environmentId}`);
      closePanel();
    },
    onSettled: () => {
      setIsPendingId(null);
    },
  });

  const item: TCommandPanelItem = useMemo(() => {
    const id = `new-project_${context.contextType}`;
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
  }, [setIsPendingId, createProject, context.teamId, context.contextType]);

  const value = useMemo(
    () => ({
      item,
    }),
    [item],
  );

  return value;
}
