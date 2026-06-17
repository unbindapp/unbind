"use client";

import { checkUpdateStatusQuery, type TUpdateStatus } from "@/api/queries/system";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TUpdateStatusContext = UseQueryResult<TUpdateStatus, Error>;

const UpdateStatusContext = createContext<TUpdateStatusContext | null>(null);

export const UpdateStatusProvider: React.FC<{
  initialData?: TUpdateStatus;
  refetchInterval?: number;
  enabled?: boolean;
  children: ReactNode;
}> = ({ refetchInterval, enabled, initialData, children }) => {
  const query = useQuery({
    ...checkUpdateStatusQuery(),
    initialData,
    refetchInterval,
    enabled,
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
