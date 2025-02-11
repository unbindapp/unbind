import ProjectCommandPanel from "@/components/command-panel/project-command-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export default function CommandPanelTrigger({
  open,
  setOpen,
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent variant="styleless" className="w-112">
        <DialogHeader>
          <DialogTitle className="sr-only">Command Panel</DialogTitle>
        </DialogHeader>
        <ProjectCommandPanel />
      </DialogContent>
    </Dialog>
  );
}
