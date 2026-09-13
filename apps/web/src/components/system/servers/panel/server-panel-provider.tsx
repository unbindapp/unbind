"use client";

import { usePanelSearchState } from "@/components/panel/use-panel-search-state";
import {
  serverPanelDefaultTabId,
  serverPanelOwnedSearchKeys,
  serverPanelServerNameKey,
  serverPanelTabKey,
  TServerPanelTabEnum,
} from "@/components/system/servers/panel/constants";
import { getRouteApi } from "@tanstack/react-router";
import { createContext, ReactNode, useContext, useMemo } from "react";

const routeApi = getRouteApi("/system");

type TServerPanelContext = {
  currentTabId: TServerPanelTabEnum;
  currentServerName: string | null;
  getOpenSearch: (serverName: string) => Record<string, unknown>;
  closePanel: () => void;
  openPanel: (serverName: string, tabId?: TServerPanelTabEnum) => void;
};

const ServerPanelContext = createContext<TServerPanelContext | null>(null);

export const ServerPanelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentTabId = routeApi.useSearch({
    select: (s) => s[serverPanelTabKey] ?? serverPanelDefaultTabId,
  });

  const {
    currentId: currentServerName,
    getOpenSearch,
    openPanel,
    closePanel,
  } = usePanelSearchState({
    idKey: serverPanelServerNameKey,
    ownedKeys: serverPanelOwnedSearchKeys,
  });

  const value: TServerPanelContext = useMemo(
    () => ({
      currentTabId,
      currentServerName,
      getOpenSearch,
      closePanel,
      openPanel: (serverName: string, tabId?: TServerPanelTabEnum) =>
        openPanel(serverName, tabId ? { [serverPanelTabKey]: tabId } : undefined),
    }),
    [currentTabId, currentServerName, getOpenSearch, openPanel, closePanel],
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
