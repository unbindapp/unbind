"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TUpdateStatusContext = AppRouterQueryResult<AppRouterOutputs["system"]["checkUpdateStatus"]>;

const UpdateStatusContext = createContext<TUpdateStatusContext | null>(null);

export const UpdateStatusProvider: React.FC<{
  initialData?: AppRouterOutputs["system"]["checkUpdateStatus"];
  refetchInterval?: number;
  children: ReactNode;
}> = ({ refetchInterval, initialData, children }) => {
  const query = api.system.checkUpdateStatus.useQuery(undefined, {
    initialData,
    refetchInterval,
  });
  return <UpdateStatusContext.Provider value={query}>{children}</UpdateStatusContext.Provider>;
};

export const useUpdateStatus = () => {
  const context = useContext(UpdateStatusContext);
  if (!context) {
    throw new Error("useUpdateStatus must be used within an UpdateStatusProvider");
  }
  return context;
};

export default UpdateStatusProvider;
