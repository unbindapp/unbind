"use client";

import { useMainStore } from "@/components/stores/main/main-store-provider";
import { LinkButton } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import { queryKeySystem, updateStatusQuery, type TUpdateStatus } from "@/lib/queries/system";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { GiftIcon } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { toast } from "sonner";

type TUpdateStatusQuery = UseQueryResult<TUpdateStatus, Error>;

const UpdateStatusContext = createContext<TUpdateStatusQuery | null>(null);

export const UpdateStatusProvider: React.FC<{
  refetchInterval?: number;
  children: ReactNode;
}> = ({ refetchInterval, children }) => {
  const query = useQuery({
    ...updateStatusQuery(),
    refetchInterval,
  });
  return <UpdateStatusContext.Provider value={query}>{children}</UpdateStatusContext.Provider>;
};

type TNewVersion =
  | {
      hasUpdateAvailable: true;
      hasUnseenUpdate: boolean;
      latestVersion: string;
      latestVersionUrl: string;
      latestVersionDescription: string | null;
      latestVersionReleaseNotes: string | null;
    }
  | {
      hasUpdateAvailable: false;
      hasUnseenUpdate: false;
      latestVersion: null;
      latestVersionUrl: null;
      latestVersionDescription: null;
      latestVersionReleaseNotes: null;
    };

// The single hook for everything update related: the raw status query plus the derived
// latest-version fields. The API sets has_update_available iff available_versions is
// non-empty, so consumers get one check instead of re-deriving it.
// `hasUnseenUpdate` additionally accounts for dismissal (toast dismissed or /update visited);
// passive indicators like the avatar dot should use it, while surfaces that must always
// reflect reality (the /update page, the menu card) use `hasUpdateAvailable`.
export const useUpdateStatus = (): TUpdateStatusQuery & TNewVersion => {
  const query = useContext(UpdateStatusContext);
  if (!query) {
    throw new Error("useUpdateStatus must be used within an UpdateStatusProvider");
  }
  const lastDismissedVersion = useMainStore((s) => s.lastDismissedVersion);
  const availableVersions = query.data?.data.available_versions;

  const latest =
    query.data?.data.has_update_available && availableVersions && availableVersions.length > 0
      ? availableVersions[availableVersions.length - 1]
      : null;

  if (!latest) {
    return {
      ...query,
      hasUpdateAvailable: false,
      hasUnseenUpdate: false,
      latestVersion: null,
      latestVersionUrl: null,
      latestVersionDescription: null,
      latestVersionReleaseNotes: null,
    } as TUpdateStatusQuery & TNewVersion;
  }

  return {
    ...query,
    hasUpdateAvailable: true,
    hasUnseenUpdate: latest.version !== lastDismissedVersion,
    latestVersion: latest.version,
    latestVersionUrl: latest.url,
    latestVersionDescription: latest.description ?? null,
    latestVersionReleaseNotes: latest.release_notes ?? null,
  } as TUpdateStatusQuery & TNewVersion;
};

export const useUpdateStatusUtils = () => {
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeySystem.updateStatus() }),
    [queryClient],
  );
  const refetch = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeySystem.updateStatus() }),
    [queryClient],
  );
  return { invalidate, refetch };
};

export default UpdateStatusProvider;

export function UpdateToastProvider({ children }: { children: ReactNode }) {
  const setLastDismissedVersion = useMainStore((state) => state.setLastDismissedVersion);

  const { hasUnseenUpdate, latestVersion } = useUpdateStatus();
  const locationHref = useLocation({ select: (l) => l.href });

  const updateShownRef = useRef(false);

  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;
    if (!hasUnseenUpdate || latestVersion === null) return;
    if (updateShownRef.current) return;

    toast.success("Update available!", {
      id: "update_toast",
      description: `Version ${latestVersion} is out. You can update now!`,
      icon: <GiftIcon className="size-full" />,
      action: (
        <div className="ml-auto max-w-full shrink-0 pl-4">
          <LinkButton
            onClick={() => {
              toast.dismiss("update_toast");
              setLastDismissedVersion(latestVersion);
            }}
            to="/update"
            search={{ from: locationHref }}
            size="sm"
            className="w-full px-3"
          >
            Update
          </LinkButton>
        </div>
      ),
      onDismiss: () => {
        setLastDismissedVersion(latestVersion);
      },
    });

    updateShownRef.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnseenUpdate, latestVersion, mounted]);

  return children;
}
