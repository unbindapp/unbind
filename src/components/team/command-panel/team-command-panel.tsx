import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import TeamCommandPanelItemsProvider, {
  useTeamCommandPanelItems,
} from "@/components/team/command-panel/team-command-panel-items-provider";
import useTeamCommandPanelData from "@/components/team/command-panel/use-team-command-panel-data";
import { ReactNode } from "react";

type TProps = {
  teamId: string;
  className?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
};

export function TeamCommandPanelTrigger({ teamId, open, setOpen, children }: TProps) {
  const { rootPage, currentPage, setCurrentPageId, allPageIds, goToParentPage } =
    useTeamCommandPanelData({ teamId });

  return (
    <TeamCommandPanelItemsProvider teamId={teamId} page={currentPage}>
      <CommandPanelTrigger
        allPageIds={allPageIds}
        currentPage={currentPage}
        title="Team Command Panel"
        description="Add a new project or manage existing projects"
        goToParentPage={goToParentPage}
        setCurrentPageId={setCurrentPageId}
        rootPage={rootPage}
        useCommandPanelItems={useTeamCommandPanelItems}
        open={open}
        setOpen={setOpen}
      >
        {children}
      </CommandPanelTrigger>
    </TeamCommandPanelItemsProvider>
  );
}
