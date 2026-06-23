"use client";

import {
  deploymentPanelDefaultTabId,
  deploymentPanelDeploymentIdKey,
  deploymentPanelTabKey,
  TDeploymentPanelTabEnum,
} from "@/components/deployment/panel/constants";
import { drawerAnimationMs } from "@/lib/constants";
import { TDeploymentShallow } from "@/lib/queries/deployments";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TDeploymentPanelContext = {
  currentTabId: TDeploymentPanelTabEnum;
  setCurrentTabId: (value: TDeploymentPanelTabEnum | null) => void;
  currentDeploymentId: string | null;
  setCurrentDeploymentId: (value: string | null) => void;
  currentDeployment: TDeploymentShallow | null;
  isPending: boolean;
  resetCurrentTabId: () => void;
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
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const currentTabId = search[deploymentPanelTabKey] ?? deploymentPanelDefaultTabId;
  const currentDeploymentId = search[deploymentPanelDeploymentIdKey] ?? null;

  const setCurrentTabId = useCallback(
    (value: TDeploymentPanelTabEnum | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [deploymentPanelTabKey]: value ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
  );
  const setCurrentDeploymentId = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [deploymentPanelDeploymentIdKey]: value ?? undefined }),
        replace: true,
        resetScroll: false,
      }),
    [navigate],
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
      isPending,
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
    [
      currentTabId,
      setCurrentTabId,
      currentDeploymentId,
      setCurrentDeploymentId,
      currentDeployment,
      isPending,
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
