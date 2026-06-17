"use client";

import { useSearchParam } from "@/lib/hooks/use-search-param";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TLogViewStateContext = {
  search: string;
  setSearch: (value: string | null) => void;
};

const LogViewStateContext = createContext<TLogViewStateContext | null>(null);

export const LogViewStateProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [search, setSearch] = useSearchParam<string>("q", "");

  const value = useMemo(
    () => ({
      search,
      setSearch,
    }),
    [search, setSearch],
  );

  return <LogViewStateContext.Provider value={value}>{children}</LogViewStateContext.Provider>;
};

export const useLogViewState = () => {
  const context = useContext(LogViewStateContext);
  if (!context) {
    throw new Error("useLogViewState must be used within an LogViewStateProvider");
  }
  return context;
};

export default LogViewStateProvider;
