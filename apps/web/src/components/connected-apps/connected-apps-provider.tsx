"use client";

import {
  connectedAppsListQuery,
  queryKeyConnectedApps,
  type TConnectedApp,
} from "@/lib/queries/connected-apps";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

export type TConnectedAppsResult = { connectedApps: TConnectedApp[] };
type TConnectedAppsContext = UseQueryResult<TConnectedAppsResult, Error>;

const ConnectedAppsContext = createContext<TConnectedAppsContext | null>(null);

export const ConnectedAppsProvider: React.FC<{
  initialData?: TConnectedAppsResult;
  children: ReactNode;
}> = ({ children, initialData }) => {
  const query = useQuery({ ...connectedAppsListQuery(), initialData });
  return <ConnectedAppsContext.Provider value={query}>{children}</ConnectedAppsContext.Provider>;
};

export const useConnectedApps = () => {
  const context = useContext(ConnectedAppsContext);
  if (!context) {
    throw new Error("useConnectedApps must be used within a ConnectedAppsProvider");
  }
  return context;
};

export const useConnectedAppsUtils = () => {
  const queryClient = useQueryClient();
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeyConnectedApps.list() }),
  };
};

export default ConnectedAppsProvider;
