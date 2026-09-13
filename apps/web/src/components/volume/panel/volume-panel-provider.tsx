"use client";

import { usePanelSearchState } from "@/components/panel/use-panel-search-state";
import {
  TVolumePanelTabEnum,
  volumePanelDefaultTabId,
  volumePanelOwnedSearchKeys,
  volumePanelTabKey,
  volumePanelVolumeIdKey,
} from "@/components/volume/panel/constants";
import { getRouteApi } from "@tanstack/react-router";
import { createContext, ReactNode, useContext, useMemo } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TVolumePanelContext = {
  currentTabId: TVolumePanelTabEnum;
  currentVolumeId: string | null;
  getOpenSearch: (volumeId: string) => Record<string, unknown>;
  closePanel: () => void;
  openPanel: (volumeId: string, tabId?: TVolumePanelTabEnum) => void;
};

const VolumePanelContext = createContext<TVolumePanelContext | null>(null);

export const VolumePanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const currentTabId = routeApi.useSearch({
    select: (s) => s[volumePanelTabKey] ?? volumePanelDefaultTabId,
  });

  const {
    currentId: currentVolumeId,
    getOpenSearch,
    openPanel,
    closePanel,
  } = usePanelSearchState({
    idKey: volumePanelVolumeIdKey,
    ownedKeys: volumePanelOwnedSearchKeys,
  });

  const value: TVolumePanelContext = useMemo(
    () => ({
      currentTabId,
      currentVolumeId,
      getOpenSearch,
      closePanel,
      openPanel: (volumeId: string, tabId?: TVolumePanelTabEnum) =>
        openPanel(volumeId, tabId ? { [volumePanelTabKey]: tabId } : undefined),
    }),
    [currentTabId, currentVolumeId, getOpenSearch, openPanel, closePanel],
  );

  return <VolumePanelContext.Provider value={value}>{children}</VolumePanelContext.Provider>;
};

export const useVolumePanel = () => {
  const context = useContext(VolumePanelContext);
  if (!context) {
    throw new Error("useVolumePanel must be used within an VolumePanelProvider");
  }
  return context;
};

export default VolumePanelProvider;
