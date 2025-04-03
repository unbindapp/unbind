"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TProjectContext = {
  query: AppRouterQueryResult<AppRouterOutputs["projects"]["get"]>;
  teamId: string;
  projectId: string;
};

const ProjectContext = createContext<TProjectContext | null>(null);

export const ProjectProvider: React.FC<{
  teamId: string;
  projectId: string;
  initialData?: AppRouterOutputs["projects"]["get"];
  children: ReactNode;
}> = ({ teamId, projectId, initialData, children }) => {
  const query = api.projects.get.useQuery({ projectId, teamId }, { initialData });
  const value = useMemo(() => ({ query, teamId, projectId }), [query, teamId, projectId]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within an ProjectProvider");
  }
  return context;
};

export default ProjectProvider;
