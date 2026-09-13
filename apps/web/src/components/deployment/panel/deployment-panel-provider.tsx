"use client";

import {
  deploymentPanelDefaultTabId,
  deploymentPanelDeploymentIdKey,
  deploymentPanelOwnedSearchKeys,
  deploymentPanelTabKey,
  TDeploymentPanelTabEnum,
} from "@/components/deployment/panel/constants";
import { usePanelSearchState } from "@/components/panel/use-panel-search-state";
import { drawerAnimationMs } from "@/lib/constants";
import { TDeploymentShallow } from "@/lib/queries/deployments";
import { getRouteApi } from "@tanstack/react-router";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TDeploymentPanelContext = {
  currentTabId: TDeploymentPanelTabEnum;
  currentDeploymentId: string | null;
  currentDeployment: TDeploymentShallow | null;
  isPending: boolean;
  getOpenSearch: (deploymentId: string) => Record<string, unknown>;
  closePanel: () => void;
  openPanel: (deploymentId: string, tabId?: TDeploymentPanelTabEnum) => void;
};

const DeploymentPanelContext = createContext<TDeploymentPanelContext | null>(null);

export const DeploymentPanelProvider: React.FC<{
  children: ReactNode;
  deployments: TDeploymentShallow[] | null;
  isPending: boolean;
}> = ({ deployments, isPending, children }) => {
  const [currentDeployment, setCurrentDeployment] = useState<TDeploymentShallow | null>(null);
  const currentTabId = routeApi.useSearch({
    select: (s) => s[deploymentPanelTabKey] ?? deploymentPanelDefaultTabId,
  });

  const {
    currentId: currentDeploymentId,
    getOpenSearch,
    openPanel,
    closePanel,
  } = usePanelSearchState({
    idKey: deploymentPanelDeploymentIdKey,
    ownedKeys: deploymentPanelOwnedSearchKeys,
  });

  const timeout = useRef<NodeJS.Timeout | null>(null);

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
      currentDeploymentId,
      currentDeployment,
      isPending,
      getOpenSearch,
      closePanel,
      openPanel: (deploymentId: string, tabId?: TDeploymentPanelTabEnum) =>
        openPanel(deploymentId, tabId ? { [deploymentPanelTabKey]: tabId } : undefined),
    }),
    [
      currentTabId,
      currentDeploymentId,
      currentDeployment,
      isPending,
      getOpenSearch,
      openPanel,
      closePanel,
    ],
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
