"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TServicesContext = {
  query: AppRouterQueryResult<AppRouterOutputs["services"]["list"]>;
  teamId: string;
  projectId: string;
  environmentId: string;
};

const ServicesContext = createContext<TServicesContext | null>(null);

export const ServicesProvider: React.FC<{
  teamId: string;
  projectId: string;
  environmentId: string;
  initialData: AppRouterOutputs["services"]["list"];
  children: ReactNode;
}> = ({ teamId, projectId, environmentId, initialData, children }) => {
  const query = api.services.list.useQuery({ teamId, projectId, environmentId }, { initialData });
  const value = useMemo(
    () => ({ query, teamId, projectId, environmentId }),
    [query, teamId, projectId, environmentId],
  );

  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
};

export const useServices = () => {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error("useServices must be used within an ServicesProvider");
  }
  return context;
};

export default ServicesProvider;

export const useServicesUtils = ({
  teamId,
  projectId,
  environmentId,
}: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) => {
  const utils = api.useUtils();
  return {
    invalidate: () => utils.services.list.invalidate({ teamId, projectId, environmentId }),
  };
};
