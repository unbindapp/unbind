"use client";

import { useMainStore } from "@/components/stores/main/main-store-provider";
import { LinkButton } from "@/components/ui/button";
import { useMounted } from "@/lib/hooks/use-mounted";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { GiftIcon } from "lucide-react";
import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { toast } from "sonner";

type TCheckForUpdatesContext = AppRouterQueryResult<AppRouterOutputs["system"]["checkForUpdates"]>;

const CheckForUpdatesContext = createContext<TCheckForUpdatesContext | null>(null);

export const CheckForUpdatesProvider: React.FC<{
  initialData?: AppRouterOutputs["system"]["checkForUpdates"];
  children: ReactNode;
}> = ({ initialData, children }) => {
  const query = api.system.checkForUpdates.useQuery(undefined, {
    initialData,
  });
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

export const useCheckNewVersion = () => {
  const { data } = useCheckForUpdates();
  const updateData = data?.data;
  const availableVersions = updateData?.available_versions;

  const hasUpdateAvailable = updateData?.has_update_available || false;
  const latestVersion =
    availableVersions && availableVersions.length > 0
      ? availableVersions[availableVersions.length - 1]
      : null;

  return {
    hasUpdateAvailable,
    latestVersion,
  };
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
    if (!hasUpdateAvailable || !latestVersion) return;
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
              if (latestVersion) setLastDismissedVersion(latestVersion);
            }}
            href="/update"
            size="sm"
            className="w-full px-3"
          >
            Update
          </LinkButton>
        </div>
      ),
      onDismiss: () => {
        if (latestVersion) setLastDismissedVersion(latestVersion);
      },
    });

    updateShownRef.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUpdateAvailable, latestVersion, mounted, lastDismissedVersion]);

  return children;
}
