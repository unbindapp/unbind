import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { TCommandPanelItem } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useCreateProjectDialog } from "@/components/project/create-project-dialog-provider";
import { FolderPlusIcon } from "lucide-react";
import { useMemo } from "react";

export default function useNewProjectItem() {
  const createProjectDialog = useCreateProjectDialog();
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const item: TCommandPanelItem | null = useMemo(() => {
    if (!createProjectDialog) return null;
    return {
      id: "new-project",
      title: "New Project",
      keywords: ["New Project", "Create project..."],
      onSelect: () => {
        closePanel();
        createProjectDialog.openCreateProjectDialog();
      },
      Icon: FolderPlusIcon,
    };
  }, [createProjectDialog, closePanel]);

  return useMemo(() => ({ item }), [item]);
}
