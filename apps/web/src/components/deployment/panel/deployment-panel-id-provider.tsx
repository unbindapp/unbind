"use client";

import { deploymentPanelDeploymentIdKey } from "@/components/deployment/panel/constants";
import { useSearchParam } from "@/lib/hooks/use-search-param";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TDeploymentPanelIdContext = {
  deploymentPanelId: string | null;
  setDeploymentPanelId: (value: string | null) => void;
};

const DeploymentPanelIdContext = createContext<TDeploymentPanelIdContext | null>(null);

export const DeploymentPanelIdProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [deploymentPanelId, setDeploymentPanelId] = useSearchParam(deploymentPanelDeploymentIdKey);

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
