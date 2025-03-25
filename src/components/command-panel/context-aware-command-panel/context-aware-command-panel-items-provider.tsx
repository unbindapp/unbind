"use client";

import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TContextAwareCommandPanelItemsContext = {
  items: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const ContextAwareCommandPanelItemsContext =
  createContext<TContextAwareCommandPanelItemsContext | null>(null);

export const ContextAwareCommandPanelItemsProvider: React.FC<{
  teamId: string;
  projectId: string;
  page: TCommandPanelPage;
  children: ReactNode;
}> = ({ teamId, projectId, page, children }) => {
  const { data, isError, isPending, error } = useQuery({
    queryKey: ["context-aware-command-panel-items", teamId, projectId, page.id],
    queryFn: page.items ? () => page.items : () => page.getItems({ teamId, projectId }),
    enabled: page.items ? false : true,
  });

  return (
    <ContextAwareCommandPanelItemsContext.Provider
      value={{
        items: page.items ? page.items : data,
        isError: page.items ? false : isError,
        isPending: page.items ? false : isPending,
        error: page.items ? null : error,
      }}
    >
      {children}
    </ContextAwareCommandPanelItemsContext.Provider>
  );
};

export const useContextAwareCommandPanelItems = () => {
  const context = useContext(ContextAwareCommandPanelItemsContext);
  if (!context) {
    throw new Error(
      "useContextAwareCommandPanelItems must be used within an ContextAwareCommandPanelItemsProvider",
    );
  }
  return context;
};

export default ContextAwareCommandPanelItemsProvider;
