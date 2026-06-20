"use client";

import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TLogViewDropdownContext = [boolean, (open: boolean | ((open: boolean) => boolean)) => void];

const LogViewDropdownContext = createContext<TLogViewDropdownContext | null>(null);

export const logViewPreferencesDropdownId = "log_view_preferences";

export const LogViewDropdownProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const navigate = useNavigate();
  const dropdown = routeApi.useSearch({ select: (s) => s.dropdown ?? null });
  const setDropdown = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, dropdown: value ?? undefined }),
        replace: true,
      }),
    [navigate],
  );

  const open = dropdown === logViewPreferencesDropdownId;

  const setOpen = useCallback(
    (prop: boolean | ((prop: boolean) => boolean)) => {
      if (typeof prop === "function") {
        const isOpen = prop(open);
        setDropdown(isOpen ? logViewPreferencesDropdownId : null);
        return;
      }

      setDropdown(prop ? logViewPreferencesDropdownId : null);
    },
    [setDropdown, open],
  );

  const value: TLogViewDropdownContext = useMemo(() => [open, setOpen], [open, setOpen]);

  return (
    <LogViewDropdownContext.Provider value={value}>{children}</LogViewDropdownContext.Provider>
  );
};

export const useLogViewDropdown = () => {
  const context = useContext(LogViewDropdownContext);
  if (!context) {
    throw new Error("useLogViewDropdown must be used within an LogViewDropdownProvider");
  }
  return context;
};

export default LogViewDropdownProvider;
