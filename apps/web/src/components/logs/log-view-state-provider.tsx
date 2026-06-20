"use client";

import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TLogViewStateContext = {
  search: string;
  setSearch: (value: string | null) => void;
};

const LogViewStateContext = createContext<TLogViewStateContext | null>(null);

export const LogViewStateProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const navigate = useNavigate();
  const search = routeApi.useSearch({ select: (s) => s.q ?? "" });
  const setSearch = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, q: value || undefined }),
        replace: true,
      }),
    [navigate],
  );

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
