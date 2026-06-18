"use client";

import { systemQuery, type TSystem } from "@/lib/queries/system";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TSystemContext = UseQueryResult<TSystem, Error>;

const SystemContext = createContext<TSystemContext | null>(null);

export const SystemProvider: React.FC<{
  initialData?: TSystem;
  children: ReactNode;
}> = ({ initialData, children }) => {
  const query = useQuery({ ...systemQuery(), initialData });
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
