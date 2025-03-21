"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TProjectsContext = AppRouterQueryResult<AppRouterOutputs["projects"]["list"]>;

const ProjectsContext = createContext<TProjectsContext | null>(null);

export const ProjectsProvider: React.FC<{
  teamId: string;
  initialData: AppRouterOutputs["projects"]["list"];
  children: ReactNode;
}> = ({ teamId, initialData, children }) => {
  const query = api.projects.list.useQuery({ teamId }, { initialData });

  return <ProjectsContext.Provider value={query}>{children}</ProjectsContext.Provider>;
};

export const useProjects = () => {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error("useProjects must be used within an ProjectsProvider");
  }
  return context;
};

export default ProjectsProvider;

export const useProjectsUtils = ({ teamId }: { teamId: string }) => {
  const utils = api.useUtils();
  return {
    invalidate: () => utils.projects.list.invalidate({ teamId }),
  };
};
