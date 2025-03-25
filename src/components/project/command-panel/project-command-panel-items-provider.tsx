"use client";

import { useProject } from "@/app/(project)/[team_id]/project/[project_id]/_components/project-provider";
import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TProjectCommandPanelItemsContext = {
  items: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const ProjectCommandPanelItemsContext = createContext<TProjectCommandPanelItemsContext | null>(
  null,
);

export const ProjectCommandPanelItemsProvider: React.FC<{
  page: TCommandPanelPage;
  children: ReactNode;
}> = ({ page, children }) => {
  const { teamId, projectId } = useProject();
  const { data, isError, isPending, error } = useQuery({
    queryKey: ["project-command-panel-items", teamId, projectId, page.id],
    queryFn: page.items ? () => page.items : () => page.getItems({ teamId, projectId }),
    enabled: page.items ? false : true,
  });

  return (
    <ProjectCommandPanelItemsContext.Provider
      value={{
        items: page.items ? page.items : data,
        isError: page.items ? false : isError,
        isPending: page.items ? false : isPending,
        error: page.items ? null : error,
      }}
    >
      {children}
    </ProjectCommandPanelItemsContext.Provider>
  );
};

export const useProjectCommandPanelItems = () => {
  const context = useContext(ProjectCommandPanelItemsContext);
  if (!context) {
    throw new Error(
      "useProjectCommandPanelItems must be used within an ProjectCommandPanelItemsProvider",
    );
  }
  return context;
};

export default ProjectCommandPanelItemsProvider;
