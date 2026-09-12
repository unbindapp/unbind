"use client";

import {
  serverPanelDefaultTabId,
  serverPanelServerNameKey,
  serverPanelTabKey,
  TServerPanelTabEnum,
} from "@/components/system/servers/panel/constants";
import { drawerAnimationMs } from "@/lib/constants";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from "react";

const routeApi = getRouteApi("/system");

type TServerPanelContext = {
  currentTabId: TServerPanelTabEnum;
  setCurrentTabId: (value: TServerPanelTabEnum | null) => void;
  currentServerName: string | null;
  setCurrentServerName: (value: string | null) => void;
  closePanel: () => void;
};

const ServerPanelContext = createContext<TServerPanelContext | null>(null);

export const ServerPanelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const currentTabId = search[serverPanelTabKey] ?? serverPanelDefaultTabId;
  const currentServerName = search[serverPanelServerNameKey] ?? null;

  const setCurrentTabId = useCallback(
    (value: TServerPanelTabEnum | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [serverPanelTabKey]: value ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );
  const setCurrentServerName = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [serverPanelServerNameKey]: value ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  const timeout = useRef<NodeJS.Timeout | null>(null);

  const value: TServerPanelContext = useMemo(
    () => ({
      currentTabId,
      setCurrentTabId,
      currentServerName,
      setCurrentServerName,
      closePanel: () => {
        setCurrentServerName(null);
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          setCurrentTabId(serverPanelDefaultTabId);
        }, drawerAnimationMs);
      },
    }),
    [currentTabId, setCurrentTabId, currentServerName, setCurrentServerName],
  );

  return <ServerPanelContext.Provider value={value}>{children}</ServerPanelContext.Provider>;
};

export const useServerPanel = () => {
  const context = useContext(ServerPanelContext);
  if (!context) {
    throw new Error("useServerPanel must be used within a ServerPanelProvider");
  }
  return context;
};

export default ServerPanelProvider;
