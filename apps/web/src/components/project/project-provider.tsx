"use client";

import { queryKeys } from "@/lib/queries/query-keys";
import { projectQuery, type TProjectShallow } from "@/lib/queries/projects";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

export type TProjectResult = { project: TProjectShallow };

type TProjectContext = {
  query: UseQueryResult<TProjectResult, Error>;
  teamId: string;
  projectId: string;
};

const ProjectContext = createContext<TProjectContext | null>(null);

export const ProjectProvider: React.FC<{
  teamId: string;
  projectId: string;
  initialData?: TProjectResult;
  children: ReactNode;
}> = ({ teamId, projectId, initialData, children }) => {
  const query = useQuery({ ...projectQuery({ teamId, projectId }), initialData });
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

export const useProjectUtils = ({ teamId, projectId }: { teamId: string; projectId: string }) => {
  const queryClient = useQueryClient();
  return {
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail({ teamId, projectId }) }),
  };
};

export default ProjectProvider;
