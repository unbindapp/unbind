"use client";

import {
  TCommandPanelItem,
  TCommandPanelPage,
} from "@/components/command-panel/types";
import { createContext, ReactNode, useContext } from "react";

type TProjectCommandPanelPageDataContext = {
  items: TCommandPanelItem[] | undefined;
  isPending?: boolean;
  isError?: boolean;
};

const ProjectCommandPanelPageDataContext =
  createContext<TProjectCommandPanelPageDataContext | null>(null);

export const ProjectCommandPanelPageDataProvider: React.FC<{
  children: ReactNode;
  page: TCommandPanelPage;
}> = ({ page, children }) => {
  const query = page.itemsQuery();
  return (
    <ProjectCommandPanelPageDataContext.Provider
      value={{
        items: page.items || query?.data,
        isPending: page.items ? false : query?.isPending,
        isError: page.items ? false : query?.isError,
      }}
    >
      {children}
    </ProjectCommandPanelPageDataContext.Provider>
  );
};

export const useProjectCommandPanelPageData = () => {
  const context = useContext(ProjectCommandPanelPageDataContext);
  if (!context) {
    throw new Error(
      "useProjectCommandPanelPageData must be used within an ProjectCommandPanelPageDataProvider"
    );
  }
  return context;
};

export default ProjectCommandPanelPageDataProvider;
