"use client";

import { checkForUpdatesQuery, type TCheckForUpdates } from "@/lib/queries/system";
import { useMainStore } from "@/components/stores/main/main-store-provider";
import { LinkButton } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { GiftIcon } from "lucide-react";
import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
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

type TNewVersion =
  | { hasUpdateAvailable: true; latestVersion: string }
  | { hasUpdateAvailable: false; latestVersion: null };

// Single source of truth for "is there an update": the API sets has_update_available
// iff available_versions is non-empty, so consumers get one check instead of re-deriving it.
export const useCheckNewVersion = (): TNewVersion => {
  const { data } = useCheckForUpdates();
  const availableVersions = data?.data.available_versions;

  const latestVersion =
    data?.data.has_update_available && availableVersions && availableVersions.length > 0
      ? availableVersions[availableVersions.length - 1]
      : null;

  return latestVersion !== null
    ? { hasUpdateAvailable: true, latestVersion }
    : { hasUpdateAvailable: false, latestVersion: null };
};

export default CheckForUpdatesProvider;

export function UpdateToastProvider({ children }: { children: ReactNode }) {
  const setLastDismissedVersion = useMainStore((state) => state.setLastDismissedVersion);
  const lastDismissedVersion = useMainStore((state) => state.lastDismissedVersion);

  const { hasUpdateAvailable, latestVersion } = useCheckNewVersion();

  const updateShownRef = useRef(false);

  const mounted = useMounted();

  useEffect(() => {
    if (!mounted) return;
    if (!hasUpdateAvailable) return;
    if (updateShownRef.current) return;
    if (lastDismissedVersion !== null && lastDismissedVersion === latestVersion) return;

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
  }, [hasUpdateAvailable, latestVersion, mounted, lastDismissedVersion]);

  return children;
}
