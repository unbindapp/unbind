import { useDeployment } from "@/components/deployment/deployment-provider";
import PodTerminal, {
  type TPodTerminalHandle,
} from "@/components/deployment/panel/tabs/terminal/pod-terminal";
import TerminalStatus, {
  type TTerminalStatus,
} from "@/components/deployment/panel/tabs/terminal/terminal-status";
import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { instancesListQuery } from "@/lib/queries/instances";
import { useQuery } from "@tanstack/react-query";
import {
  BoxIcon,
  Maximize2Icon,
  Minimize2Icon,
  RotateCwIcon,
  ServerIcon,
  TerminalIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function Terminal() {
  const { teamId, projectId, environmentId, serviceId } = useDeployment();

  // No focus refetch — alt-tabbing to copy something would otherwise refetch and yank
  // the terminal onto a different instance mid-session.
  const { data, isPending, error } = useQuery({
    ...instancesListQuery({ teamId, projectId, environmentId, serviceId }),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });

  const pods = useMemo(() => data?.data ?? [], [data]);

  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [status, setStatus] = useState<TTerminalStatus>("connecting");

  const terminalRef = useRef<TPodTerminalHandle>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void wrapperRef.current?.requestFullscreen().catch(() => {});
  }, []);

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
    return <CenteredMessage>Loading instances…</CenteredMessage>;
  }

  if (error) {
    return (
      <div className="w-full p-3">
        <ErrorCard message={error.message} />
      </div>
    );
  }

  if (!activePod || !activeContainer) {
    return (
      <CenteredMessage>
        <NoItemsCard Icon={TerminalIcon}>No running instances to connect to</NoItemsCard>
      </CenteredMessage>
    );
  }

  return (
    <div ref={wrapperRef} className="bg-background flex min-h-0 w-full flex-1 flex-col">
      <div className="flex w-full items-center gap-1.5 border-b px-2 py-2 sm:px-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {pods.length > 1 ? (
            <Select value={activePod.kubernetes_name} onValueChange={setSelectedPod}>
              <SelectTrigger className="h-8 max-w-full" classNameInnerContainer="items-center">
                <ServerIcon className="text-muted-foreground size-3.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pods.map((p, i) => (
                  <SelectItem key={p.kubernetes_name} value={p.kubernetes_name}>
                    Instance {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-muted-foreground flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold">
              <ServerIcon className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">Instance 1</span>
            </div>
          )}
          {containers.length > 1 && (
            <Select value={activeContainer} onValueChange={setSelectedContainer}>
              <SelectTrigger className="h-8 max-w-full" classNameInnerContainer="items-center">
                <BoxIcon className="text-muted-foreground size-3.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {containers.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <TerminalStatus status={status} />
          {status === "disconnected" && (
            <Button size="sm" variant="outline" onClick={() => terminalRef.current?.reconnect()}>
              <RotateCwIcon className="-ml-0.5 size-4" />
              Reconnect
            </Button>
          )}
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

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex min-h-0 w-full flex-1 items-center justify-center p-6 text-center text-sm">
      {children}
    </div>
  );
}
