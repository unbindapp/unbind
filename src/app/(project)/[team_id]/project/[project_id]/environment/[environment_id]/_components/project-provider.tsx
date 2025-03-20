"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TProjectContext = AppRouterQueryResult<AppRouterOutputs["projects"]["get"]>;

const ProjectContext = createContext<TProjectContext | null>(null);

export const ProjectProvider: React.FC<{
  teamId: string;
  projectId: string;
  initialData: AppRouterOutputs["projects"]["get"];
  children: ReactNode;
}> = ({ teamId, projectId, initialData, children }) => {
  const query = api.projects.get.useQuery({ projectId, teamId }, { initialData });

  return <ProjectContext.Provider value={query}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within an ProjectProvider");
  }
  return context;
};

export default ProjectProvider;
