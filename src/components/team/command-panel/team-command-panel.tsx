import { CommandPanelTrigger } from "@/components/command-panel/command-panel";
import { CommandPanelStateProvider } from "@/components/command-panel/command-panel-state-provider";
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
  modalId: string;
  children: ReactNode;
};

export default function TeamCommandPanelTrigger({
  teamId,
  open,
  setOpen,
  modalId,
  children,
}: TProps) {
  return (
    <CommandPanelStateProvider>
      <TeamCommandPanelTrigger_ modalId={modalId} teamId={teamId} open={open} setOpen={setOpen}>
        {children}
      </TeamCommandPanelTrigger_>
    </CommandPanelStateProvider>
  );
}

function TeamCommandPanelTrigger_({ teamId, open, setOpen, modalId, children }: TProps) {
  const { rootPage, currentPage, setCurrentPageId, allPageIds, goToParentPage } =
    useTeamCommandPanelData({ teamId });

  return (
    <TeamCommandPanelItemsProvider modalId={modalId} teamId={teamId} page={currentPage}>
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
