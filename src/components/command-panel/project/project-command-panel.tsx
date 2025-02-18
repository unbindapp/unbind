import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import ProjectCommandPanelItemsProvider, {
  useProjectCommandPanelItems,
} from "@/components/command-panel/project/project-command-panel-data-provider";
import useProjectCommandPanelConfig from "@/components/command-panel/project/use-project-command-panel-config";
import { ReactNode } from "react";

type Props = {
  teamId: string;
  projectId: string;
  className?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
};

export function ProjectCommandPanelTrigger({
  teamId,
  projectId,
  open,
  setOpen,
  children,
}: Props) {
  const {
    rootPage,
    currentPage,
    setCurrentPageId,
    allPageIds,
    goToParentPage,
  } = useProjectCommandPanelConfig({ teamId });

  return (
    <ProjectCommandPanelItemsProvider
      teamId={teamId}
      projectId={projectId}
      page={currentPage}
    >
      <CommandPanelTrigger
        allPageIds={allPageIds}
        currentPage={currentPage}
        title="Project Command Panel"
        description="Add a new service or manage existing services"
        goToParentPage={goToParentPage}
        setCurrentPageId={setCurrentPageId}
        rootPage={rootPage}
        useCommandPanelItems={useProjectCommandPanelItems}
        open={open}
        setOpen={setOpen}
      >
        {children}
      </CommandPanelTrigger>
    </ProjectCommandPanelItemsProvider>
  );
}
