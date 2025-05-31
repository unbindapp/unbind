"use client";

import {
  deploymentPanelDefaultTabId,
  deploymentPanelDeploymentIdKey,
  DeploymentPanelTabEnum,
  deploymentPanelTabKey,
  TDeploymentPanelTabEnum,
} from "@/components/deployment/panel/constants";
import { drawerAnimationMs } from "@/lib/constants";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { parseAsStringEnum, useQueryState, UseQueryStateReturn } from "nuqs";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

type TDeploymentPanelContext = {
  currentTabId: TDeploymentPanelTabEnum;
  setCurrentTabId: UseQueryStateReturn<TDeploymentPanelTabEnum, TDeploymentPanelTabEnum>["1"];
  currentDeploymentId: string | null;
  setCurrentDeploymentId: UseQueryStateReturn<string | null, string | null>["1"];
  currentDeployment: TDeploymentShallow | null;
  resetCurrentTabId: () => void;
  closePanel: () => void;
  openPanel: (deploymentId: string, tabId?: TDeploymentPanelTabEnum) => void;
};

const DeploymentPanelContext = createContext<TDeploymentPanelContext | null>(null);

export const DeploymentPanelProvider: React.FC<{
  children: ReactNode;
  deployments: TDeploymentShallow[] | null;
}> = ({ deployments, children }) => {
  const [currentDeployment, setCurrentDeployment] = useState<TDeploymentShallow | null>(null);
  const [currentTabId, setCurrentTabId] = useQueryState(
    deploymentPanelTabKey,
    parseAsStringEnum(DeploymentPanelTabEnum.options).withDefault(deploymentPanelDefaultTabId),
  );

  const [currentDeploymentId, setCurrentDeploymentId] = useQueryState(
    deploymentPanelDeploymentIdKey,
  );

  const timeout = useRef<NodeJS.Timeout | null>(null);
  const tabTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentDeploymentId) {
      if (!deployments) return;
      setCurrentDeployment(
        deployments.find((deployment) => deployment.id === currentDeploymentId) || null,
      );
    } else {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      timeout.current = setTimeout(() => {
        setCurrentDeployment(null);
      }, drawerAnimationMs);
    }
  }, [currentDeploymentId, deployments]);

  const value: TDeploymentPanelContext = useMemo(
    () => ({
      currentTabId,
      setCurrentTabId,
      currentDeploymentId,
      setCurrentDeploymentId,
      currentDeployment,
      openPanel: (deploymentId: string, tabId?: TDeploymentPanelTabEnum) => {
        setCurrentTabId(tabId ?? deploymentPanelDefaultTabId);
        setCurrentDeploymentId(deploymentId);
      },
      closePanel: () => {
        setCurrentDeploymentId(null);
        if (tabTimeout.current) clearTimeout(tabTimeout.current);
        tabTimeout.current = setTimeout(() => {
          setCurrentTabId(deploymentPanelDefaultTabId);
        }, drawerAnimationMs);
      },
      resetCurrentTabId: () => setCurrentTabId(deploymentPanelDefaultTabId),
    }),
    [currentTabId, setCurrentTabId, currentDeploymentId, setCurrentDeploymentId, currentDeployment],
  );

  return (
    <DeploymentPanelContext.Provider value={value}>{children}</DeploymentPanelContext.Provider>
  );
};

export const useDeploymentPanel = () => {
  const context = useContext(DeploymentPanelContext);
  if (!context) {
    throw new Error("useDeploymentPanel must be used within an DeploymentPanelProvider");
  }
  return context;
};

export default DeploymentPanelProvider;
