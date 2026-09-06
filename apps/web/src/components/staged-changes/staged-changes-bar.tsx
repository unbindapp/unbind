import { useDeviceSize } from "@/components/providers/device-size-provider";
import {
  availableBarSlots,
  barBounds,
  barSlotEdge,
  barSlotPosition,
  clampToBounds,
  nearestBarSlot,
  projectPoint,
  resolveBarSlot,
  type TBarLayout,
  type TSize,
} from "@/components/staged-changes/bar-position";
import StagedChangesDetailsDialog from "@/components/staged-changes/staged-changes-details-dialog";
import {
  useStagedChangeCount,
  useStagedChangesPlan,
  useStagedChangesStore,
} from "@/components/staged-changes/staged-changes-provider";
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
import { useMainStore } from "@/components/stores/main/main-store-provider";
import { EllipsisVerticalIcon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const exitDurationMs = 500;
// Critically damped with a 0.4s response, the spring Apple's picture in picture lands with
const landingSpring = { type: "spring", stiffness: 250, damping: 32 } as const;
const emptySize: TSize = { width: 0, height: 0 };

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

function useElementSize(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [size, setSize] = useState<TSize>(emptySize);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const measure = () => setSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);

  return size;
}

// The bar lives in a track that spans the space between the insets, so a slot is an offset
// inside the track and the track resizing is how the bar learns that an inset changed
function useBarSlots(isMounted: boolean) {
  const { isExtraSmall } = useDeviceSize();
  const preferredSlot = useMainStore((s) => s.stagedChangesBarSlot);
  const setPreferredSlot = useMainStore((s) => s.setStagedChangesBarSlot);
  const reducedMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragControls = useDragControls();
  // Held from pointer down until release, so the closed hand shows before any movement
  const [isHeld, setIsHeld] = useState(false);
  const isDraggingRef = useRef(false);
  const settledTargetRef = useRef<string | null>(null);
  const lastViewportRef = useRef<string | null>(null);

  // The track is static and spans the viewport. The insets are measured off sentinel elements
  // so an inset change only moves the slot targets, never the bar itself
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const topInsetRef = useRef<HTMLDivElement>(null);
  const bottomInsetRef = useRef<HTMLDivElement>(null);
  const track = useElementSize(trackRef, isMounted);
  const bar = useElementSize(barRef, isMounted);
  const topInset = useElementSize(topInsetRef, isMounted);
  const bottomInset = useElementSize(bottomInsetRef, isMounted);
  const layout: TBarLayout = {
    track,
    bar,
    insets: { top: topInset.height, bottom: bottomInset.height },
  };
  const isMeasured = track.width > 0 && bar.width > 0;

  const slots = availableBarSlots({ isExtraSmall });
  const defaultSlot = isExtraSmall ? "bottom-left" : "top-left";
  const slot = resolveBarSlot(preferredSlot ?? defaultSlot, slots, layout);
  const position = barSlotPosition(slot, layout);
  // Pixel constraints on purpose: a ref would make Motion re-scale the bar's position
  // whenever the track or the bar resizes, cutting off the landing spring
  const dragConstraints = barBounds(layout);

  useLayoutEffect(() => {
    if (!isMeasured || isDraggingRef.current) return;
    const target = `${position.x},${position.y}`;
    if (settledTargetRef.current === target) return;
    settledTargetRef.current = target;

    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    const viewportChanged = lastViewportRef.current !== viewport;
    lastViewportRef.current = viewport;
    if (viewportChanged || reducedMotion) {
      x.jump(position.x);
      y.jump(position.y);
      return;
    }
    animate(x, position.x, landingSpring);
    animate(y, position.y, landingSpring);
  }, [isMeasured, position.x, position.y, reducedMotion, x, y]);

  useEffect(() => {
    if (!isHeld) return;
    const release = () => setIsHeld(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [isHeld]);

  const onHandlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    setIsHeld(true);
    dragControls.start(event);
  };

  const onDragStart = () => {
    isDraggingRef.current = true;
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    isDraggingRef.current = false;
    if (!isMeasured) return;
    const projected = clampToBounds(
      projectPoint({ x: x.get(), y: y.get() }, info.velocity),
      layout,
    );
    const landing = nearestBarSlot(projected, slots, layout);
    const target = barSlotPosition(landing, layout);
    settledTargetRef.current = `${target.x},${target.y}`;
    setPreferredSlot(landing);
    if (reducedMotion) {
      x.jump(target.x);
      y.jump(target.y);
      return;
    }
    animate(x, target.x, { ...landingSpring, velocity: info.velocity.x });
    animate(y, target.y, { ...landingSpring, velocity: info.velocity.y });
  };

  return {
    trackRef,
    barRef,
    topInsetRef,
    bottomInsetRef,
    x,
    y,
    edge: barSlotEdge(slot),
    dragConstraints,
    dragControls,
    isHeld,
    onHandlePointerDown,
    onDragStart,
    onDragEnd,
  };
}

export default function StagedChangesBar() {
  const count = useStagedChangeCount();
  const { deploy, plan } = useStagedChangesPlan();
  const { isMounted, isOpen } = useBarPresence(count > 0);
  const {
    trackRef,
    barRef,
    topInsetRef,
    bottomInsetRef,
    x,
    y,
    edge,
    dragConstraints,
    dragControls,
    isHeld,
    onHandlePointerDown,
    onDragStart,
    onDragEnd,
  } = useBarSlots(isMounted);
  // The count stays readable while the bar slides out
  const lastCount = useRef(count);
  if (count > 0) lastCount.current = count;

  if (!isMounted) return null;

  const shownCount = lastCount.current;
  const hasError = deploy.error !== null || plan.error !== null;

  return (
    // aria-live keeps the bar interactive while a modal drawer is open, the same way toasts stay usable.
    // The track keeps catching presses while the bar slides out or jumps, so a press that misses
    // the bar never reaches the drawer overlay behind it and closes the drawer.
    <div
      ref={trackRef}
      aria-live="polite"
      data-slot="staged-changes-bar"
      className="pointer-events-none fixed inset-x-2 inset-y-0 z-900"
    >
      <div
        ref={topInsetRef}
        aria-hidden
        className="absolute top-0 h-(--changes-bar-inset-top) w-0"
      />
      <div
        ref={bottomInsetRef}
        aria-hidden
        className="absolute bottom-0 h-(--changes-bar-inset-bottom) w-0"
      />
      <motion.div
        ref={barRef}
        drag
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={dragConstraints}
        dragElastic={0.15}
        dragMomentum={false}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{ x, y }}
        className="pointer-events-auto absolute top-0 left-0 w-full sm:w-auto"
      >
        <div
          data-error={hasError || undefined}
          data-closed={!isOpen || undefined}
          data-edge={edge}
          data-held={isHeld || undefined}
          className="bg-card border-change/24 shadow-shadow-color/shadow-opacity data-error:border-destructive/30 flex w-full items-center gap-4 overflow-hidden rounded-lg border p-1.5 shadow-lg will-change-transform [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),scale_150ms_ease-out] data-closed:pointer-events-none data-held:scale-95 data-[edge=bottom]:data-closed:transform-[translateY(calc(100%+var(--changes-bar-inset-bottom)+1rem))] data-[edge=top]:data-closed:transform-[translateY(calc(-100%-var(--changes-bar-inset-top)-1rem))]"
        >
          <div className="bg-change/6 absolute top-0 left-0 h-full w-full" />
          <div
            onPointerDown={onHandlePointerDown}
            className="relative flex min-w-0 flex-1 cursor-grab touch-none items-center gap-1.5 self-stretch overflow-hidden pr-1 pl-1 select-none"
          >
            <GripVerticalIcon className="text-change/60 -ml-0.5 size-4.5 shrink-0" />
            <p className="text-change min-w-0 shrink truncate text-sm leading-tight font-semibold">
              Apply {shownCount} {shownCount === 1 ? "change" : "changes"}
            </p>
          </div>
          <div className="relative flex items-center justify-end gap-1">
            <StagedChangesDetailsDialog>
              <Button
                variant="ghost-change"
                size="sm"
                className="text-foreground has-hover:hover:text-foreground active:text-foreground py-1.75"
              >
                Details
              </Button>
            </StagedChangesDetailsDialog>
            <Button
              variant="change"
              size="sm"
              isPending={deploy.isPending}
              onClick={() => deploy.mutate()}
              className="py-1.75"
            >
              Deploy
            </Button>
            <DiscardMenu disabled={deploy.isPending} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DiscardMenu({ disabled }: { disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [discardHandle] = useState(() => createDialogHandle());
  const discardAll = useStagedChangesStore((s) => s.discardAll);
  const count = useStagedChangeCount();

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              data-open={isOpen || undefined}
              disabled={disabled}
              fadeOnDisabled={false}
              variant="ghost-change"
              size="icon"
              aria-label="More options"
              className="text-muted-more-foreground group/button has-hover:hover:text-foreground active:text-foreground size-8.5 rounded-md"
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
              All staged changes will be thrown away. Nothing will be deployed.
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
