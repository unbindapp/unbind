"use client";

import { useDeploymentPanelId } from "@/components/deployment/panel/deployment-panel-id-provider";
import {
  servicePanelDefaultTabId,
  servicePanelServiceIdKey,
  servicePanelTabKey,
  TServicePanelTabEnum,
} from "@/components/service/panel/constants";
import { drawerAnimationMs } from "@/lib/constants";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TServicePanelContext = {
  currentTabId: TServicePanelTabEnum;
  setCurrentTabId: (value: TServicePanelTabEnum | null) => void;
  currentServiceId: string | null;
  setCurrentServiceId: (value: string | null) => void;
  resetCurrentTabId: () => void;
  closePanel: () => void;
  openPanel: (serviceId: string, tabId?: TServicePanelTabEnum) => void;
  // The terminal tab can maximize to fill the viewport; while it does, Esc should exit
  // fullscreen instead of closing the drawer, so the drawer needs to know.
  isTerminalFullscreen: boolean;
  setIsTerminalFullscreen: (value: boolean) => void;
};

const ServicePanelContext = createContext<TServicePanelContext | null>(null);

export const ServicePanelProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const { setDeploymentPanelId } = useDeploymentPanelId();
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const currentTabId = search[servicePanelTabKey] ?? servicePanelDefaultTabId;
  const currentServiceId = search[servicePanelServiceIdKey] ?? null;

  const setCurrentTabId = useCallback(
    (value: TServicePanelTabEnum | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [servicePanelTabKey]: value ?? undefined }),
        replace: true,
        // Opening/closing the panel writes a search param, which is a navigation.
        // Without this, the router's default resetScroll jumps the page to the top.
        resetScroll: false,
      }),
    [navigate],
  );
  const setCurrentServiceId = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [servicePanelServiceIdKey]: value ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );

  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);

  const timeout = useRef<NodeJS.Timeout | null>(null);

  const value: TServicePanelContext = useMemo(
    () => ({
      currentTabId,
      setCurrentTabId,
      currentServiceId,
      setCurrentServiceId,
      openPanel: (serviceId: string, tabId?: TServicePanelTabEnum) => {
        // Opening a different service must drop the previous service's deployment context.
        setDeploymentPanelId(null);
        setCurrentTabId(tabId ?? servicePanelDefaultTabId);
        setCurrentServiceId(serviceId);
      },
      closePanel: () => {
        setDeploymentPanelId(null);
        setCurrentServiceId(null);
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          setCurrentTabId(servicePanelDefaultTabId);
        }, drawerAnimationMs);
      },
      resetCurrentTabId: () => setCurrentTabId(servicePanelDefaultTabId),
      isTerminalFullscreen,
      setIsTerminalFullscreen,
    }),
    [
      currentTabId,
      setCurrentTabId,
      currentServiceId,
      setCurrentServiceId,
      setDeploymentPanelId,
      isTerminalFullscreen,
    ],
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
