"use client";

import { deploymentPanelDeploymentIdKey } from "@/components/deployment/panel/constants";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { createContext, ReactNode, useCallback, useContext, useMemo } from "react";

const routeApi = getRouteApi("/$team_id/project/$project_id");

type TDeploymentPanelIdContext = {
  deploymentPanelId: string | null;
  setDeploymentPanelId: (value: string | null) => void;
};

const DeploymentPanelIdContext = createContext<TDeploymentPanelIdContext | null>(null);

export const DeploymentPanelIdProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const navigate = useNavigate();
  const deploymentPanelId = routeApi.useSearch({
    select: (s) => s[deploymentPanelDeploymentIdKey] ?? null,
  });
  const setDeploymentPanelId = useCallback(
    (value: string | null) =>
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, [deploymentPanelDeploymentIdKey]: value ?? undefined }),
        replace: true,
      }),
    [navigate],
  );

  const value: TDeploymentPanelIdContext = useMemo(
    () => ({
      deploymentPanelId,
      setDeploymentPanelId,
    }),
    [deploymentPanelId, setDeploymentPanelId],
  );

  return (
    <DeploymentPanelIdContext.Provider value={value}>{children}</DeploymentPanelIdContext.Provider>
  );
};

export const useDeploymentPanelId = () => {
  const context = useContext(DeploymentPanelIdContext);
  if (!context) {
    throw new Error("useDeploymentPanelId must be used within an DeploymentPanelIdProvider");
  }
  return context;
};

export default DeploymentPanelIdProvider;
