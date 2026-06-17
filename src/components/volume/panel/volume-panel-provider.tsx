"use client";

import {
  TVolumePanelTabEnum,
  volumePanelDefaultTabId,
  volumePanelVolumeIdKey,
  VolumePanelTabEnum,
  volumePanelTabKey,
} from "@/components/volume/panel/constants";
import { drawerAnimationMs } from "@/lib/constants";
import { useSearchParam } from "@/lib/hooks/use-search-param";
import { createContext, ReactNode, useContext, useMemo, useRef } from "react";

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
  const [currentTabId, setCurrentTabId] = useSearchParam<TVolumePanelTabEnum>(
    volumePanelTabKey,
    volumePanelDefaultTabId,
  );

  const [currentVolumeId, setCurrentVolumeId] = useSearchParam(volumePanelVolumeIdKey);

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
