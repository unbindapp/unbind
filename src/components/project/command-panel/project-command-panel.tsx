import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import ProjectCommandPanelItemsProvider, {
  useProjectCommandPanelItems,
} from "@/components/project/command-panel/project-command-panel-items-provider";
import useProjectCommandPanelData from "@/components/project/command-panel/use-project-command-panel-data";
import { ReactNode } from "react";

type TProps = {
  className?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
};

export function ProjectCommandPanelTrigger({ open, setOpen, children }: TProps) {
  const { rootPage, currentPage, setCurrentPageId, allPageIds, goToParentPage } =
    useProjectCommandPanelData();

  return (
    <ProjectCommandPanelItemsProvider page={currentPage}>
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
