import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import ProjectCommandPanelItemsProvider, {
  useProjectCommandPanelItems,
} from "@/components/command-panel/project/project-command-panel-items-provider";
import useProjectCommandPanelData from "@/components/command-panel/project/use-project-command-panel-data";
import { ReactNode } from "react";

type TProps = {
  teamId: string;
  projectId: string;
  className?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
};

export function ProjectCommandPanelTrigger({ teamId, projectId, open, setOpen, children }: TProps) {
  const { rootPage, currentPage, setCurrentPageId, allPageIds, goToParentPage } =
    useProjectCommandPanelData({ teamId });

  return (
    <ProjectCommandPanelItemsProvider teamId={teamId} projectId={projectId} page={currentPage}>
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
