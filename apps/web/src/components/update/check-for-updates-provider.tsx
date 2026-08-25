"use client";

import { checkForUpdatesQuery, queryKeySystem, type TCheckForUpdates } from "@/lib/queries/system";
import { useMainStore } from "@/components/stores/main/main-store-provider";
import { LinkButton } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { GiftIcon } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from "react";
import { toast } from "sonner";

type TCheckForUpdatesContext = UseQueryResult<TCheckForUpdates, Error>;

const CheckForUpdatesContext = createContext<TCheckForUpdatesContext | null>(null);

export const CheckForUpdatesProvider: React.FC<{
  initialData?: TCheckForUpdates;
  children: ReactNode;
}> = ({ initialData, children }) => {
  const query = useQuery({ ...checkForUpdatesQuery(), initialData });
  return (
    <CheckForUpdatesContext.Provider value={query}>{children}</CheckForUpdatesContext.Provider>
  );
};

export const useCheckForUpdates = () => {
  const context = useContext(CheckForUpdatesContext);
  if (!context) {
    throw new Error("useCheckForUpdates must be used within an CheckForUpdatesProvider");
  }
  return context;
};

export const useCheckForUpdatesUtils = () => {
  const queryClient = useQueryClient();
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeySystem.updateCheck() }),
    [queryClient],
  );
  const refetch = useCallback(
    () => queryClient.refetchQueries({ queryKey: queryKeySystem.updateCheck() }),
    [queryClient],
  );
  return { invalidate, refetch };
};

type TNewVersion =
  | {
      hasUpdateAvailable: true;
      hasUnseenUpdate: boolean;
      latestVersion: string;
      latestVersionUrl: string;
    }
  | {
      hasUpdateAvailable: false;
      hasUnseenUpdate: false;
      latestVersion: null;
      latestVersionUrl: null;
    };

// Single source of truth for "is there an update": the API sets has_update_available
// iff available_versions is non-empty, so consumers get one check instead of re-deriving it.
// `hasUnseenUpdate` additionally accounts for dismissal (toast dismissed or /update visited);
// passive indicators like the avatar dot should use it, while surfaces that must always
// reflect reality (the /update page, the menu card) use `hasUpdateAvailable`.
export const useCheckNewVersion = (): TNewVersion => {
  const { data } = useCheckForUpdates();
  const lastDismissedVersion = useMainStore((s) => s.lastDismissedVersion);
  const availableVersions = data?.data.available_versions;

  const latest =
    data?.data.has_update_available && availableVersions && availableVersions.length > 0
      ? availableVersions[availableVersions.length - 1]
      : null;

  if (!latest) {
    return {
      hasUpdateAvailable: false,
      hasUnseenUpdate: false,
      latestVersion: null,
      latestVersionUrl: null,
    };
  }

  return {
    hasUpdateAvailable: true,
    hasUnseenUpdate: latest.version !== lastDismissedVersion,
    latestVersion: latest.version,
    latestVersionUrl: latest.url,
  };
};

export default CheckForUpdatesProvider;

export function UpdateToastProvider({ children }: { children: ReactNode }) {
  const setLastDismissedVersion = useMainStore((state) => state.setLastDismissedVersion);

  const { hasUnseenUpdate, latestVersion } = useCheckNewVersion();
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
