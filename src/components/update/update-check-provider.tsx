"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TUpdateCheckContext = AppRouterQueryResult<AppRouterOutputs["system"]["checkForUpdates"]>;

const UpdateCheckContext = createContext<TUpdateCheckContext | null>(null);

export const UpdateCheckProvider: React.FC<{
  initialData?: AppRouterOutputs["system"]["checkForUpdates"];
  children: ReactNode;
}> = ({ initialData, children }) => {
  const query = api.system.checkForUpdates.useQuery(undefined, {
    initialData,
  });
  return <UpdateCheckContext.Provider value={query}>{children}</UpdateCheckContext.Provider>;
};

export const useUpdateCheck = () => {
  const context = useContext(UpdateCheckContext);
  if (!context) {
    throw new Error("useUpdateCheck must be used within an UpdateCheckProvider");
  }
  return context;
};

export default UpdateCheckProvider;
