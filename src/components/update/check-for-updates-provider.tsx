"use client";

import { LinkButton } from "@/components/ui/button";
import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { PartyPopperIcon } from "lucide-react";
import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useIsMounted } from "usehooks-ts";

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

export default CheckForUpdatesProvider;

export function UpdateToastProvider({ children }: { children: ReactNode }) {
  const { data } = useCheckForUpdates();
  const updateData = data?.data;
  const availableVersions = updateData?.available_versions;

  const hasUpdateAvailable = updateData?.has_update_available;
  const newestVersion =
    availableVersions && availableVersions.length > 0
      ? availableVersions[availableVersions.length - 1]
      : null;

  const updateShownRef = useRef(false);
  const mounted = useIsMounted();
  const isMounted = mounted();

  useEffect(() => {
    if (!isMounted) return;
    if (!hasUpdateAvailable || !newestVersion) return;
    if (updateShownRef.current) return;

    toast.success("Update available!", {
      id: "update-toast",
      description: `Version ${newestVersion} is out!`,
      icon: <PartyPopperIcon />,
      action: (
        <div className="ml-auto max-w-full shrink-0 pl-4">
          <LinkButton
            onClick={() => toast.dismiss("update-toast")}
            href="/update"
            size="sm"
            className="w-full px-3"
          >
            Update
          </LinkButton>
        </div>
      ),
    });

    updateShownRef.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUpdateAvailable, newestVersion, mounted]);

  return children;
}
