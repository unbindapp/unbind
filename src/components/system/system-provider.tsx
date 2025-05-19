"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TSystemContext = AppRouterQueryResult<AppRouterOutputs["system"]["get"]>;

const SystemContext = createContext<TSystemContext | null>(null);

export const SystemProvider: React.FC<{
  initialData: AppRouterOutputs["system"]["get"];
  children: ReactNode;
}> = ({ initialData, children }) => {
  const query = api.system.get.useQuery(undefined, { initialData });
  return <SystemContext.Provider value={query}>{children}</SystemContext.Provider>;
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error("useSystem must be used within an SystemProvider");
  }
  return context;
};

export default SystemProvider;
