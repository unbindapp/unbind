import {
  useChangeCount,
  useChangesPlan,
  useChangesStore,
} from "@/components/changes/changes-provider";
import ChangesDetailsDialog from "@/components/changes/changes-details-dialog";
import { Button } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVerticalIcon, PencilLineIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const exitDurationMs = 500;

// Keeps the bar mounted through its exit transition and starts the enter
// transition from the hidden state, like the toasts do
function useBarPresence(hasChanges: boolean) {
  const [isMounted, setIsMounted] = useState(hasChanges);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (hasChanges) {
      setIsMounted(true);
      let inner: number;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setIsOpen(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setIsOpen(false);
    const timeout = setTimeout(() => setIsMounted(false), exitDurationMs);
    return () => clearTimeout(timeout);
  }, [hasChanges]);

  return { isMounted, isOpen };
}

export default function StagedChangesBar() {
  const count = useChangeCount();
  const { deploy, plan } = useChangesPlan();
  const { isMounted, isOpen } = useBarPresence(count > 0);
  // The count stays readable while the bar slides out
  const lastCount = useRef(count);
  if (count > 0) lastCount.current = count;

  if (!isMounted) return null;

  const shownCount = lastCount.current;
  const hasError = deploy.error !== null || plan.error !== null;

  return (
    // aria-live keeps the bar interactive while a modal drawer is open, the same way toasts stay usable
    <div
      aria-live="polite"
      data-staged-changes-bar=""
      className="pointer-events-none fixed inset-x-2 bottom-[calc(var(--navbar-height,0px)+0.5rem)] z-900 flex justify-center sm:inset-x-auto sm:top-[calc(var(--navbar-height,0px)+0.5rem)] sm:bottom-auto sm:left-2 sm:justify-start"
    >
      <div
        data-error={hasError || undefined}
        data-closed={!isOpen || undefined}
        className="bg-card border-change/30 shadow-shadow-color/shadow-opacity data-error:border-destructive/30 pointer-events-auto flex w-full items-center gap-1 rounded-xl border p-1.5 shadow-lg transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform data-closed:pointer-events-none data-closed:translate-y-[150%] data-closed:opacity-0 sm:w-auto sm:data-closed:-translate-y-[150%]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 pr-1 pl-2">
          {hasError ? (
            <TriangleAlertIcon className="text-destructive size-4.5 shrink-0" />
          ) : (
            <PencilLineIcon className="text-change size-4.5 shrink-0" />
          )}
          <p className="min-w-0 shrink text-sm leading-tight font-semibold whitespace-nowrap">
            {shownCount} {shownCount === 1 ? "Change" : "Changes"}
          </p>
        </div>
        <ChangesDetailsDialog>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Details
          </Button>
        </ChangesDetailsDialog>
        <Button
          variant="change"
          size="sm"
          isPending={deploy.isPending}
          onClick={() => deploy.mutate()}
        >
          Deploy
        </Button>
        <DiscardMenu disabled={deploy.isPending} />
      </div>
    </div>
  );
}

function DiscardMenu({ disabled }: { disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [discardHandle] = useState(() => createDialogHandle());
  const discardAll = useChangesStore((s) => s.discardAll);
  const count = useChangeCount();

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              data-open={isOpen || undefined}
              disabled={disabled}
              fadeOnDisabled={false}
              variant="ghost"
              size="icon"
              aria-label="More options"
              className="text-muted-more-foreground group/button rounded-md"
            >
              <EllipsisVerticalIcon className="size-5 transition-transform group-data-open/button:rotate-90" />
            </Button>
          }
        />
        <DropdownMenuContent className="z-950 w-44" sideOffset={4} align="end">
          <DropdownMenuGroup>
            {/* The dialog lives outside the menu; nested inside the open modal menu it would be inert */}
            <DialogTrigger
              nativeButton={false}
              handle={discardHandle}
              render={
                <DropdownMenuItem className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive">
                  <Trash2Icon className="-ml-0.5 size-5" />
                  <p className="min-w-0 shrink leading-tight">Discard All</p>
                </DropdownMenuItem>
              }
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog handle={discardHandle}>
        <DialogContent hideXButton classNameInnerWrapper="w-112 max-w-full">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Discard {count} {count === 1 ? "Change" : "Changes"}
            </DialogTitle>
            <DialogDescription>
              {count === 1
                ? "The staged change will be thrown away. Nothing has been deployed."
                : `All ${count} staged changes will be thrown away. Nothing has been deployed.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose
              className="text-muted-foreground"
              render={
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              }
            />
            <Button
              variant="destructive"
              onClick={() => {
                discardAll();
                discardHandle.close();
              }}
            >
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
