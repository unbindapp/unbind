import {
  rootPanelPageIdForProject,
  panelPageKey,
} from "@/components/command-panel/constants";
import ProjectCommandPanel from "@/components/command-panel/project-command-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryState } from "nuqs";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const rootPages = [rootPanelPageIdForProject];

export default function CommandPanelTrigger({
  open,
  setOpen,
  children,
}: Props) {
  const [panelPageId] = useQueryState(panelPageKey);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(e) => {
          if (panelPageId === null) return;
          if (!rootPages.includes(panelPageId)) {
            e.preventDefault();
          }
        }}
        variant="styleless"
        className="w-112"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Command Panel</DialogTitle>
        </DialogHeader>
        <ProjectCommandPanel />
      </DialogContent>
    </Dialog>
  );
}
