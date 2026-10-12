"use client";

import { isSystemViewer, meQuery } from "@/lib/queries/me";
import { systemQuery, type TSystem } from "@/lib/queries/system";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TSystemContext = UseQueryResult<TSystem, Error>;

const SystemContext = createContext<TSystemContext | null>(null);

export const SystemProvider: React.FC<{
  initialData?: TSystem;
  children: ReactNode;
}> = ({ initialData, children }) => {
  const { data: me } = useQuery(meQuery);
  const query = useQuery({ ...systemQuery(), initialData, enabled: isSystemViewer(me) });
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
