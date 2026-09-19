import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import TitleChip from "@/components/command-panel/title-chip";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useCreateAndOpenProject } from "@/components/project/use-create-and-open-project";
import { toast } from "@/components/ui/toast";
import { ProjectCreateFormSchema } from "@/lib/queries/projects";
import { FolderIcon, FolderPlusIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useEffect, useMemo, useState } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

const mainPageId = "new-project";
const subpageId = "new-project_subpage";
const createItemId = `${subpageId}_create`;

function getNameError(name: string) {
  const parsed = ProjectCreateFormSchema.safeParse({ name });
  return parsed.success ? null : parsed.error.issues[0].message;
}

export default function useNewProjectItem({ context }: TProps) {
  const teamId = context.teamId ?? "";
  const isTeamContext = context.contextType === "team";

  const [showNameError, setShowNameError] = useState(false);
  const nameErrorForSearch = useCommandPanelStore((s) => getNameError(s.search));
  const nameError = showNameError ? nameErrorForSearch : null;
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { closePanel, panelId, setPanelPageId } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  useEffect(() => {
    if (panelId === null) setShowNameError(false);
  }, [panelId]);

  const { mutateAsync: createAndOpenProject } = useCreateAndOpenProject({
    teamId,
    // Both params are cleared before navigating so the history entry left behind is clean
    onBeforeNavigate: async () => {
      await closePanel();
      await setPanelPageId(null);
    },
  });

  const item: TCommandPanelItem | null = useMemo(() => {
    if (!isTeamContext) return null;
    return {
      id: mainPageId,
      title: "New Project",
      keywords: ["New Project", "Create project..."],
      Icon: FolderPlusIcon,
      subpage: {
        id: subpageId,
        title: "New Project",
        parentPageId: contextCommandPanelRootPage,
        inputPlaceholder: "Project name",
        InputIcon: FolderIcon,
        disableCommandFilter: true,
        setSearchDebounceMs: 50,
        commandEmptyText: nameError ?? "Enter a name for the project",
        commandEmptyIsError: nameError !== null,
        getItems: ({ search }) => {
          const name = search?.trim();
          if (!name || nameError) return [];
          return [
            {
              id: createItemId,
              title: `Create Project: ${name}`,
              Title: () => (
                <>
                  Create Project: <TitleChip>{name}</TitleChip>
                </>
              ),
              keywords: [],
              Icon: FolderPlusIcon,
              onSelect: async ({ isPendingId }) => {
                if (isPendingId !== null) return;
                if (getNameError(name)) {
                  setShowNameError(true);
                  return;
                }
                setIsPendingId(createItemId);
                const res = await ResultAsync.fromPromise(createAndOpenProject(name), (e) =>
                  e instanceof Error ? e : new Error("Unknown error"),
                );
                setIsPendingId(null);
                if (res.isErr()) {
                  toast.add({
                    type: "error",
                    title: "Failed to create project",
                    description: res.error.message,
                  });
                }
              },
            },
          ];
        },
      },
    };
  }, [isTeamContext, nameError, createAndOpenProject, setIsPendingId]);

  return useMemo(() => ({ item }), [item]);
}
