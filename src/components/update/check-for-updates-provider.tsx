"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

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
