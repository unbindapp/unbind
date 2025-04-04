"use client";

import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TContextCommandPanelItemsContext = {
  items: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const ContextCommandPanelItemsContext = createContext<TContextCommandPanelItemsContext | null>(
  null,
);

export const ContextCommandPanelItemsProvider: React.FC<{
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
    <ContextCommandPanelItemsContext.Provider
      value={{
        items: page.items ? page.items : data,
        isError: page.items ? false : isError,
        isPending: page.items ? false : isPending,
        error: page.items ? null : error,
      }}
    >
      {children}
    </ContextCommandPanelItemsContext.Provider>
  );
};

export const useContextCommandPanelItems = () => {
  const context = useContext(ContextCommandPanelItemsContext);
  if (!context) {
    throw new Error(
      "useContextCommandPanelItems must be used within an ContextCommandPanelItemsProvider",
    );
  }
  return context;
};

export default ContextCommandPanelItemsProvider;
