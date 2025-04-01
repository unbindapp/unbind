"use client";

import { parseAsString, useQueryState } from "nuqs";
import { createContext, Dispatch, ReactNode, useContext, useMemo } from "react";

type TLogViewStateContext = {
  search: string;
  setSearch: Dispatch<React.SetStateAction<string>>;
};

const LogViewStateContext = createContext<TLogViewStateContext | null>(null);

export const LogViewStateProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));

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
