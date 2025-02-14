"use client";

import {
  TCommandPanelItem,
  TCommandPanelPage,
} from "@/components/command-panel/types";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TProjectCommandPanelItemsContext = {
  items: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
};

const ProjectCommandPanelItemsContext =
  createContext<TProjectCommandPanelItemsContext | null>(null);

export const ProjectCommandPanelItemsProvider: React.FC<{
  teamId: string;
  projectId: string;
  page: TCommandPanelPage;
  children: ReactNode;
}> = ({ teamId, projectId, page, children }) => {
  const { data, isError, isPending } = useQuery({
    queryKey: ["project-command-panel", teamId, page.id],
    queryFn: page.items
      ? () => page.items
      : () => page.getItems({ teamId, projectId }),
    enabled: page.items ? false : true,
  });

  return (
    <ProjectCommandPanelItemsContext.Provider
      value={{
        items: page.items ? page.items : data,
        isError: page.items ? false : isError,
        isPending: page.items ? false : isPending,
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
      "useProjectCommandPanelItems must be used within an ProjectCommandPanelItemsProvider"
    );
  }
  return context;
};

export default ProjectCommandPanelItemsProvider;
