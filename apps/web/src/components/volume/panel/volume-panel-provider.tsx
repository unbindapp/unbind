"use client";

import {
  TVolumePanelTabEnum,
  volumePanelDefaultTabId,
  volumePanelTabKey,
  volumePanelVolumeIdKey,
} from "@/components/volume/panel/constants";
import { drawerAnimationMs } from "@/lib/constants";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TVolumePanelContext = {
  currentTabId: TVolumePanelTabEnum;
  setCurrentTabId: (value: TVolumePanelTabEnum | null) => void;
  currentVolumeId: string | null;
  setCurrentVolumeId: (value: string | null) => void;
  resetCurrentTabId: () => void;
  closePanel: () => void;
  openPanel: (serviceId: string, tabId?: TVolumePanelTabEnum) => void;
};

const VolumePanelContext = createContext<TVolumePanelContext | null>(null);

export const VolumePanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const currentTabId = search[volumePanelTabKey] ?? volumePanelDefaultTabId;
  const currentVolumeId = search[volumePanelVolumeIdKey] ?? null;

  const setCurrentTabId = useCallback(
    (value: TVolumePanelTabEnum | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [volumePanelTabKey]: value ?? undefined }),
        replace: true,
      }),
    [navigate],
  );
  const setCurrentVolumeId = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [volumePanelVolumeIdKey]: value ?? undefined }),
        replace: true,
      }),
    [navigate],
  );

  const timeout = useRef<NodeJS.Timeout | null>(null);

  const value: TVolumePanelContext = useMemo(
    () => ({
      currentTabId,
      setCurrentTabId,
      currentVolumeId,
      setCurrentVolumeId,
      openPanel: (serviceId: string, tabId?: TVolumePanelTabEnum) => {
        setCurrentTabId(tabId ?? volumePanelDefaultTabId);
        setCurrentVolumeId(serviceId);
      },
      closePanel: () => {
        setCurrentVolumeId(null);
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          setCurrentTabId(volumePanelDefaultTabId);
        }, drawerAnimationMs);
      },
      resetCurrentTabId: () => setCurrentTabId(volumePanelDefaultTabId),
    }),
    [currentTabId, setCurrentTabId, currentVolumeId, setCurrentVolumeId],
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
