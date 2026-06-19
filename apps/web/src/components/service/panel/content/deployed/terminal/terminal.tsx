import { BlockItemButtonLike } from "@/components/block";
import PodTerminal, {
  type TPodTerminalHandle,
} from "@/components/service/panel/content/deployed/terminal/pod-terminal";
import TerminalStatus, {
  type TTerminalStatus,
} from "@/components/service/panel/content/deployed/terminal/terminal-status";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useService } from "@/components/service/service-provider";
import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { Button } from "@/components/ui/button";
import DropdownSelect from "@/components/ui/dropdown-select";
import { cn } from "@/components/ui/utils";
import { instancesListQuery } from "@/lib/queries/instances";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import {
  BoxIcon,
  LoaderIcon,
  Maximize2Icon,
  Minimize2Icon,
  RotateCwIcon,
  ServerIcon,
  TerminalIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function Terminal() {
  const { teamId, projectId, environmentId, serviceId } = useService();

  // No focus refetch — alt-tabbing to copy something would otherwise refetch and yank
  // the terminal onto a different instance mid-session.
  const { data, isPending, error } = useQuery({
    ...instancesListQuery({ teamId, projectId, environmentId, serviceId }),
  });

  const pods = useMemo(() => data?.data ?? [], [data]);

  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [status, setStatus] = useState<TTerminalStatus>("connecting");

  const terminalRef = useRef<TPodTerminalHandle>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { isTerminalFullscreen: isFullscreen, setIsTerminalFullscreen } = useServicePanel();

  const toggleFullscreen = useCallback(
    () => setIsTerminalFullscreen(!isFullscreen),
    [isFullscreen, setIsTerminalFullscreen],
  );

  useHotkey("Escape", () => setIsTerminalFullscreen(false), { enabled: isFullscreen });
  useEffect(() => () => setIsTerminalFullscreen(false), [setIsTerminalFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;

    // The terminal sits inside a vaul Drawer whose root has `will-change: transform`, which makes
    // a `position: fixed` child size to the drawer instead of the viewport. Dropping it while
    // maximized lets `fixed inset-0` fill the browser tab. The drawer has no transform at rest, so
    // this is invisible (and we restore it on exit for a smooth close animation).
    const drawer = wrapperRef.current?.closest<HTMLElement>("[data-vaul-drawer]");
    if (!drawer) return;
    const prevWillChange = drawer.style.willChange;
    drawer.style.willChange = "auto";
    return () => {
      drawer.style.willChange = prevWillChange;
    };
  }, [isFullscreen]);

  // Pin the instance so a background refetch can't silently move us to another pod.
  useEffect(() => {
    if (pods.length === 0) return;
    setSelectedPod((prev) => {
      if (prev && pods.some((p) => p.kubernetes_name === prev)) return prev;
      return (pods.find((p) => p.instances.some((i) => i.ready)) ?? pods[0]).kubernetes_name;
    });
  }, [pods]);

  const activePod = useMemo(() => {
    return (
      pods.find((p) => p.kubernetes_name === selectedPod) ??
      pods.find((p) => p.instances.some((i) => i.ready)) ??
      pods[0]
    );
  }, [pods, selectedPod]);

  const containers = useMemo(
    () => activePod?.instances.map((i) => i.kubernetes_name) ?? [],
    [activePod],
  );

  useEffect(() => {
    if (containers.length === 0) return;
    setSelectedContainer((prev) => (prev && containers.includes(prev) ? prev : containers[0]));
  }, [containers]);

  const activeContainer = useMemo(() => {
    if (selectedContainer && containers.includes(selectedContainer)) return selectedContainer;
    return containers[0];
  }, [containers, selectedContainer]);

  if (isPending) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center pb-4">
        <LoaderIcon className="text-muted-more-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col p-3">
        <ErrorCard message={error.message} />
      </div>
    );
  }

  if (!activePod || !activeContainer) {
    return (
      <div className="flex w-full flex-col p-3">
        <NoItemsCard Icon={TerminalIcon}>No running instances to connect to</NoItemsCard>
      </div>
    );
  }

  const compactTriggerClassName = "w-fit min-w-0 shrink gap-1.5 px-2.5 py-1.5 text-sm rounded-md";

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "bg-background flex min-h-0 w-full flex-1 flex-col overflow-hidden sm:rounded-bl-2xl",
        isFullscreen && "fixed inset-0 z-50 rounded-none sm:rounded-none",
      )}
    >
      <div className="flex w-full items-center justify-between gap-1.5 border-b p-2 sm:p-2.5">
        <div className="flex min-w-0 shrink items-center gap-1.5">
          {pods.length > 0 && (
            <DropdownSelect
              items={pods.map((p, i) => ({
                value: p.kubernetes_name,
                label: `Instance ${i + 1}`,
              }))}
              value={activePod.kubernetes_name}
              onChange={setSelectedPod}
              classNameContent="w-auto"
              align="start"
            >
              {({ isOpen }) => (
                <BlockItemButtonLike
                  asElement="button"
                  text={`Instance ${pods.findIndex((p) => p.kubernetes_name === activePod.kubernetes_name) + 1}`}
                  Icon={({ className }) => <ServerIcon className={cn("scale-90", className)} />}
                  variant="outline"
                  open={isOpen}
                  className={compactTriggerClassName}
                  classNameChevron="size-4"
                  classNameIcon="size-4 -ml-0.5"
                />
              )}
            </DropdownSelect>
          )}
          {containers.length > 1 && (
            <DropdownSelect
              items={containers.map((c) => ({ value: c, label: c }))}
              value={activeContainer}
              onChange={setSelectedContainer}
              classNameContent="w-auto"
              align="start"
            >
              {({ isOpen }) => (
                <BlockItemButtonLike
                  asElement="button"
                  text={activeContainer}
                  Icon={({ className }) => <BoxIcon className={cn("scale-90", className)} />}
                  variant="outline"
                  open={isOpen}
                  className={compactTriggerClassName}
                  classNameChevron="size-4"
                  classNameIcon="size-4"
                />
              )}
            </DropdownSelect>
          )}
          <TerminalStatus status={status} />
          {status === "disconnected" && (
            <Button
              className="min-w-0 shrink"
              size="sm"
              variant="outline"
              onClick={() => terminalRef.current?.reconnect()}
            >
              <RotateCwIcon className="-ml-1.5 size-4" />
              <p className="truncate">Reconnect</p>
            </Button>
          )}
        </div>
        <div className="flex min-w-0 shrink items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? (
              <Minimize2Icon className="size-4.5" />
            ) : (
              <Maximize2Icon className="size-4.5" />
            )}
          </Button>
        </div>
      </div>
      <PodTerminal
        ref={terminalRef}
        key={`${activePod.kubernetes_name}/${activeContainer}`}
        teamId={teamId}
        projectId={projectId}
        environmentId={environmentId}
        serviceId={serviceId}
        podName={activePod.kubernetes_name}
        container={activeContainer}
        onStatusChange={setStatus}
      />
    </div>
  );
}
