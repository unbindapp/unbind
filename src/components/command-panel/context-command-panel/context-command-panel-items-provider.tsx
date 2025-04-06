"use client";

import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import {
  TCommandPanelItem,
  TCommandPanelPage,
  TContextCommandPanelContext,
} from "@/components/command-panel/types";
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
  context: TContextCommandPanelContext;
  idSuffix: string;
  children: ReactNode;
}> = ({ teamId, projectId, page, idSuffix, context, children }) => {
  const search = useCommandPanelStore((s) => s.search);

  const { data, isError, isPending, error } = useQuery({
    queryKey: [
      "context-aware-command-panel-items",
      teamId,
      projectId,
      page.id,
      idSuffix,
      context,
      search,
    ],
    queryFn: page.items ? () => page.items : () => page.getItems({ teamId, projectId, search }),
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
