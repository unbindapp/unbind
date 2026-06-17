"use client";

import { useDeploymentPanelId } from "@/components/deployment/panel/deployment-panel-id-provider";
import {
  servicePanelDefaultTabId,
  servicePanelServiceIdKey,
  servicePanelTabKey,
  TServicePanelTabEnum,
} from "@/components/service/panel/constants";
import { drawerAnimationMs } from "@/lib/constants";
import useEffectAfterMount from "@/lib/hooks/use-effect-after-mount";
import { useSearchParam } from "@/lib/hooks/use-search-param";
import { createContext, ReactNode, useContext, useMemo, useRef } from "react";

type TServicePanelContext = {
  currentTabId: TServicePanelTabEnum;
  setCurrentTabId: (value: TServicePanelTabEnum | null) => void;
  currentServiceId: string | null;
  setCurrentServiceId: (value: string | null) => void;
  resetCurrentTabId: () => void;
  closePanel: () => void;
  openPanel: (serviceId: string, tabId?: TServicePanelTabEnum) => void;
};

const ServicePanelContext = createContext<TServicePanelContext | null>(null);

export const ServicePanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { setDeploymentPanelId } = useDeploymentPanelId();
  const [currentTabId, setCurrentTabId] = useSearchParam<TServicePanelTabEnum>(
    servicePanelTabKey,
    servicePanelDefaultTabId,
  );

  const [currentServiceId, setCurrentServiceId] = useSearchParam(servicePanelServiceIdKey);

  useEffectAfterMount(() => {
    setDeploymentPanelId(null);
  }, [currentServiceId]);

  const timeout = useRef<NodeJS.Timeout | null>(null);

  const value: TServicePanelContext = useMemo(
    () => ({
      currentTabId,
      setCurrentTabId,
      currentServiceId,
      setCurrentServiceId,
      openPanel: (serviceId: string, tabId?: TServicePanelTabEnum) => {
        setCurrentTabId(tabId ?? servicePanelDefaultTabId);
        setCurrentServiceId(serviceId);
      },
      closePanel: () => {
        setCurrentServiceId(null);
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          setCurrentTabId(servicePanelDefaultTabId);
        }, drawerAnimationMs);
      },
      resetCurrentTabId: () => setCurrentTabId(servicePanelDefaultTabId),
    }),
    [currentTabId, setCurrentTabId, currentServiceId, setCurrentServiceId],
  );

  return <ServicePanelContext.Provider value={value}>{children}</ServicePanelContext.Provider>;
};

export const useServicePanel = () => {
  const context = useContext(ServicePanelContext);
  if (!context) {
    throw new Error("useServicePanel must be used within an ServicePanelProvider");
  }
  return context;
};

export default ServicePanelProvider;
