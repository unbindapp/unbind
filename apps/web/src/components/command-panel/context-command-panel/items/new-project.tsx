import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import TitleChip from "@/components/command-panel/title-chip";
import { TCommandPanelItem, TContextCommandPanelContext } from "@/components/command-panel/types";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { useCreateAndOpenProject } from "@/components/project/use-create-and-open-project";
import { toast } from "@/components/ui/toast";
import { generateProjectName } from "@/lib/helpers/generate-project-name";
import { ProjectCreateFormSchema } from "@/lib/queries/projects";
import { FolderIcon, FolderPlusIcon, TriangleAlertIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo, useState } from "react";

type TProps = {
  context: TContextCommandPanelContext;
};

const mainPageId = "new-project";
const subpageId = "new-project_subpage";
const createItemId = `${subpageId}_create`;

export default function useNewProjectItem({ context }: TProps) {
  const teamId = context.teamId ?? "";
  const isTeamContext = context.contextType === "team";

  const [generatedName, setGeneratedName] = useState(generateProjectName);
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const { mutateAsync: createAndOpenProject } = useCreateAndOpenProject({
    teamId,
    onBeforeNavigate: closePanel,
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
        inputPlaceholder: generatedName,
        InputIcon: FolderIcon,
        disableCommandFilter: true,
        setSearchDebounceMs: 50,
        commandEmptyText: "Enter a project name above",
        getItems: ({ search }) => {
          const parsed = ProjectCreateFormSchema.safeParse({ name: search ?? "" });
          if (!parsed.success) {
            return [
              {
                id: createItemId,
                title: parsed.error.issues[0].message,
                keywords: [],
                Icon: TriangleAlertIcon,
                disabled: true,
                isError: true,
              },
            ];
          }
          const name = parsed.data.name || generatedName;
          return [
            {
              id: createItemId,
              title: `Create ${name}`,
              Title: () => (
                <>
                  Create <TitleChip>{name}</TitleChip>
                </>
              ),
              description: parsed.data.name ? undefined : "Generated name, type to change it",
              keywords: [],
              Icon: FolderPlusIcon,
              onSelect: async ({ isPendingId }) => {
                if (isPendingId !== null) return;
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
                  return;
                }
                setGeneratedName(generateProjectName());
              },
            },
          ];
        },
      },
    };
  }, [isTeamContext, generatedName, createAndOpenProject, setIsPendingId]);

  return useMemo(() => ({ item }), [item]);
}
