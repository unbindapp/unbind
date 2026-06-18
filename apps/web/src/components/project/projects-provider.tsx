"use client";

import { queryKeys } from "@/lib/queries/query-keys";
import { projectsListQuery, type TProjectShallow } from "@/lib/queries/projects";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

export type TProjectsResult = { projects: TProjectShallow[] };
type TProjectsContext = UseQueryResult<TProjectsResult, Error>;

const ProjectsContext = createContext<TProjectsContext | null>(null);

export const ProjectsProvider: React.FC<{
  teamId: string;
  initialData?: TProjectsResult;
  children: ReactNode;
}> = ({ teamId, initialData, children }) => {
  const query = useQuery({ ...projectsListQuery(teamId), initialData });

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
  const queryClient = useQueryClient();
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(teamId) }),
  };
};
