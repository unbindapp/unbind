"use client";

import {
  TCommandPanelItem,
  TCommandPanelPage,
} from "@/components/command-panel/types";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TProjectCommandPanelDataContext = {
  data: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
};

const ProjectCommandPanelDataContext =
  createContext<TProjectCommandPanelDataContext | null>(null);

export const ProjectCommandPanelDataProvider: React.FC<{
  page: TCommandPanelPage;
  children: ReactNode;
}> = ({ page, children }) => {
  const { data, isError, isPending } = useQuery({
    queryKey: ["project-command-panel", page.id],
    queryFn: page.items ? () => page.items : page.getItems,
    enabled: page.items ? false : true,
  });

  return (
    <ProjectCommandPanelDataContext.Provider
      value={{
        data: page.items ? page.items : data,
        isError: page.items ? false : isError,
        isPending: page.items ? false : isPending,
      }}
    >
      {children}
    </ProjectCommandPanelDataContext.Provider>
  );
};

export const useProjectCommandPanelData = () => {
  const context = useContext(ProjectCommandPanelDataContext);
  if (!context) {
    throw new Error(
      "useProjectCommandPanelData must be used within an ProjectCommandPanelDataProvider"
    );
  }
  return context;
};

export default ProjectCommandPanelDataProvider;
