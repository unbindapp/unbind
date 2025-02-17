import {
  commandPanelPageIdKey,
  rootCommandPanelPageIdForProject,
} from "@/components/command-panel/constants";
import ProjectCommandPanel from "@/components/command-panel/project-command-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useQueryState } from "nuqs";
import { ReactNode } from "react";

type Props = {
  teamId: string;
  projectId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
};

const rootPages = [rootCommandPanelPageIdForProject];

export default function CommandPanelTrigger({
  teamId,
  projectId,
  open,
  setOpen,
  children,
}: Props) {
  const [panelPageId] = useQueryState(commandPanelPageIdKey);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(e) => {
          if (typeof window === "undefined") return;
          const isTouchScreen = window.matchMedia("(pointer: coarse)").matches;
          if (!isTouchScreen) return;
          const element = e.target as HTMLElement | null;
          if (element === null) return;
          const focusable = element.querySelector("[tabindex]");
          if (!focusable) return;
          e.preventDefault();
          // @ts-expect-error this is a valid call
          focusable.focus?.();
        }}
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
          <DialogDescription className="sr-only">
            Deploy something...
          </DialogDescription>
        </DialogHeader>
        <ProjectCommandPanel teamId={teamId} projectId={projectId} />
      </DialogContent>
    </Dialog>
  );
}
