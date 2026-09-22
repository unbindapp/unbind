"use client";

import BrandIcon from "@/components/icons/brand";
import { useMainStore } from "@/components/stores/main/main-store-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import { isSystemAdmin, meQuery } from "@/lib/queries/me";
import {
  applyUpdate as applyUpdateFn,
  queryKeySystem,
  updateStatusQuery,
  type TUpdateStatus,
} from "@/lib/queries/system";
import type { Change } from "@/lib/server/client.gen";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { CircleCheckBigIcon, ExternalLinkIcon, GiftIcon, RefreshCwIcon } from "lucide-react";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

type TUpdateStatusQuery = UseQueryResult<TUpdateStatus, Error>;

export type TUpdatePhase = "idle" | "updating" | "succeeded" | "failed";

type TUpdateFlow = {
  phase: TUpdatePhase;
  targetVersion: string | null;
  startedAt: number | null;
  startUpdate: (version: string) => void;
  isStartingUpdate: boolean;
  startUpdateError: Error | null;
};

const UpdateStatusContext = createContext<{ query: TUpdateStatusQuery; flow: TUpdateFlow } | null>(
  null,
);

// Update status is admin-only on the API, so the query never runs for other users:
// they see no update card, dot, or toast, and never hit a 403.
// The update flow (phase, start time, fast polling) lives here rather than on the
// /system/update page so leaving the page doesn't reset the counter or the phase.
export const UpdateStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: me } = useQuery(meQuery);
  const queryClient = useQueryClient();
  const setLastUpdatedAndDismissedVersion = useMainStore(
    (s) => s.setLastUpdatedAndDismissedVersion,
  );

  const [phase, setPhase] = useState<TUpdatePhase>("idle");
  const [targetVersion, setTargetVersion] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const query = useQuery({
    ...updateStatusQuery(),
    refetchInterval: phase === "updating" ? 5000 : undefined,
    enabled: isSystemAdmin(me),
  });
  const { data, dataUpdatedAt } = query;
  const status = data?.data;

  const {
    mutate: startUpdate,
    isPending: isStartingUpdate,
    error: startUpdateError,
  } = useMutation({
    mutationFn: applyUpdateFn,
    onSuccess: (_, version) => {
      setPhase("updating");
      setTargetVersion(version);
      setStartedAt(Date.now());
      queryClient.refetchQueries({ queryKey: queryKeySystem.updateStatus() });
    },
  });

  // Pick up an update started elsewhere (another tab or admin) while idling here.
  useEffect(() => {
    if (phase !== "idle") return;
    if (!status?.in_progress) return;

    setPhase("updating");
    setTargetVersion(status.target_version ?? null);
    setStartedAt((t) => t ?? Date.now());
  }, [phase, status]);

  // `ready` can come from a status snapshot cached before the update started, so only
  // trust it when the server binary already runs the version we're updating to.
  useEffect(() => {
    if (phase !== "updating") return;
    if (!status?.ready) return;
    if (targetVersion === null || status.current_version !== targetVersion) return;

    setPhase("succeeded");
    // The person who ran the update saw the changelog already; skip the updated toast.
    setLastUpdatedAndDismissedVersion(targetVersion);
  }, [phase, status, targetVersion, setLastUpdatedAndDismissedVersion]);

  // The timestamp guard skips failed snapshots fetched before a retry started.
  useEffect(() => {
    if (phase === "succeeded" || phase === "failed") return;
    if (!status?.failed) return;
    if (startedAt !== null && dataUpdatedAt <= startedAt) return;

    setPhase("failed");
    setTargetVersion(status.target_version ?? null);
  }, [phase, status, dataUpdatedAt, startedAt]);

  // A newer release after a finished update starts the flow over.
  useEffect(() => {
    if (phase !== "succeeded") return;
    if (!status) return;
    const hasNewer = status.available_versions.some((v) =>
      isNewerVersion(v.version, status.current_version),
    );
    if (!hasNewer) return;

    setPhase("idle");
    setTargetVersion(null);
    setStartedAt(null);
  }, [phase, status]);

  const flow = useMemo<TUpdateFlow>(
    () => ({ phase, targetVersion, startedAt, startUpdate, isStartingUpdate, startUpdateError }),
    [phase, targetVersion, startedAt, startUpdate, isStartingUpdate, startUpdateError],
  );

  const value = useMemo(() => ({ query, flow }), [query, flow]);

  return <UpdateStatusContext.Provider value={value}>{children}</UpdateStatusContext.Provider>;
};

type TNewVersion =
  | {
      hasUpdateAvailable: true;
      hasUnseenUpdate: boolean;
      latestVersion: string;
      latestVersionUrl: string;
      latestVersionSummary: string | null;
      latestVersionChanges: Change[];
    }
  | {
      hasUpdateAvailable: false;
      hasUnseenUpdate: false;
      latestVersion: null;
      latestVersionUrl: null;
      latestVersionSummary: null;
      latestVersionChanges: [];
    };

// Server responses can momentarily list versions the deployment already runs (e.g. a
// stale cache right after an update), so never trust the list blindly.
function isNewerVersion(version: string, currentVersion: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [candidate, current] = [parse(version), parse(currentVersion)];
  if (candidate.some(Number.isNaN) || current.some(Number.isNaN)) {
    return version !== currentVersion;
  }
  for (let i = 0; i < Math.max(candidate.length, current.length); i++) {
    const diff = (candidate[i] ?? 0) - (current[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

// The single hook for everything update related: the raw status query, the derived
// latest-version fields and the update flow. An update is only considered available
// when available_versions contains something newer than current_version, regardless
// of what the API's has_update_available flag claims.
// `hasUnseenUpdate` additionally accounts for dismissal (toast dismissed or /system/update visited);
// passive indicators like the avatar dot should use it, while surfaces that must always
// reflect reality (the /system/update page, the menu card) use `hasUpdateAvailable`.
export const useUpdateStatus = (): TUpdateStatusQuery & TNewVersion & TUpdateFlow => {
  const context = useContext(UpdateStatusContext);
  if (!context) {
    throw new Error("useUpdateStatus must be used within an UpdateStatusProvider");
  }
  const { query, flow } = context;
  const lastDismissedVersion = useMainStore((s) => s.lastDismissedVersion);
  const currentVersion = query.data?.data.current_version;
  const newerVersions =
    currentVersion !== undefined
      ? (query.data?.data.available_versions.filter((v) =>
          isNewerVersion(v.version, currentVersion),
        ) ?? [])
      : [];

  const latest = newerVersions.length > 0 ? newerVersions[newerVersions.length - 1] : null;

  if (!latest) {
    return {
      ...query,
      ...flow,
      hasUpdateAvailable: false,
      hasUnseenUpdate: false,
      latestVersion: null,
      latestVersionUrl: null,
      latestVersionSummary: null,
      latestVersionChanges: [],
    } as TUpdateStatusQuery & TNewVersion & TUpdateFlow;
  }

  return {
    ...query,
    ...flow,
    hasUpdateAvailable: true,
    hasUnseenUpdate: latest.version !== lastDismissedVersion,
    latestVersion: latest.version,
    latestVersionUrl: latest.url,
    latestVersionSummary: latest.summary || null,
    latestVersionChanges: latest.changes,
  } as TUpdateStatusQuery & TNewVersion & TUpdateFlow;
};

export default UpdateStatusProvider;

export function UpdateToastProvider({ children }: { children: ReactNode }) {
  useUpdatedToast();

  const setLastDismissedVersion = useMainStore((state) => state.setLastDismissedVersion);

  const { hasUnseenUpdate, latestVersion } = useUpdateStatus();

  const updateShownRef = useRef(false);

  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;
    if (!hasUnseenUpdate || latestVersion === null) return;
    if (updateShownRef.current) return;

    toast.add({
      type: "success",
      title: "Update available!",
      id: "update_toast",
      description: `Version ${latestVersion} is out. You can update now!`,
      data: {
        icon: <GiftIcon className="size-full" />,
        action: (
          <LinkButton
            onClick={() => {
              toast.close("update_toast");
              setLastDismissedVersion(latestVersion);
            }}
            to="/system/update"
            size="sm"
          >
            Update
          </LinkButton>
        ),
      },
      onClose: () => {
        setLastDismissedVersion(latestVersion);
      },
    });

    updateShownRef.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnseenUpdate, latestVersion, mounted]);

  return children;
}

const bundleVersion = import.meta.env.VITE_APP_VERSION ?? "development";
const updatedToastId = "updated_toast";

// Shown once per browser after the instance moves to a new version. A tab that still
// runs the bundle of the old version gets a Reload action instead of the changelog;
// the changelog toast then follows on the fresh bundle.
function useUpdatedToast() {
  const lastUpdatedAndDismissedVersion = useMainStore((s) => s.lastUpdatedAndDismissedVersion);
  const setLastUpdatedAndDismissedVersion = useMainStore(
    (s) => s.setLastUpdatedAndDismissedVersion,
  );
  const { data } = useUpdateStatus();
  const mounted = useMounted();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    if (shownRef.current) return;
    const status = data?.data;
    if (!status || status.in_progress) return;

    const { current_version: currentVersion, current_version_url: currentVersionUrl } = status;
    if (lastUpdatedAndDismissedVersion === null) {
      setLastUpdatedAndDismissedVersion(currentVersion);
      return;
    }
    if (lastUpdatedAndDismissedVersion === currentVersion) return;

    const isBundleStale = bundleVersion !== currentVersion;

    toast.add({
      type: "success",
      id: updatedToastId,
      title: `Updated to ${currentVersion}`,
      description: "Unbind has been updated to a new version.",
      data: {
        icon: <CircleCheckBigIcon className="size-full" />,
        action: isBundleStale ? (
          <Button size="sm" onClick={() => window.location.reload()}>
            <RefreshCwIcon className="-ml-1.5 size-4" />
            <p className="min-w-0 shrink">Reload</p>
          </Button>
        ) : (
          <Button
            size="sm"
            className="group"
            onClick={() => {
              toast.close(updatedToastId);
              setLastUpdatedAndDismissedVersion(currentVersion);
            }}
            render={<a href={currentVersionUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <div className="relative -ml-1.5 size-4 shrink-0 transition-[rotate,opacity] group-active:rotate-45 has-hover:group-hover:rotate-45">
              <BrandIcon
                brand="github"
                color="monochrome"
                className="size-full group-active:opacity-0 has-hover:group-hover:opacity-0"
              />
              <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active:opacity-100 has-hover:group-hover:opacity-100" />
            </div>
            <p className="min-w-0 shrink">Changelog</p>
          </Button>
        ),
      },
      onClose: () => {
        setLastUpdatedAndDismissedVersion(currentVersion);
      },
    });

    shownRef.current = true;
  }, [mounted, data, lastUpdatedAndDismissedVersion, setLastUpdatedAndDismissedVersion]);
}
