"use client";

import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import {
  TCommandPanelItem,
  TCommandPanelPage,
  TContextCommandPanelContext,
} from "@/components/command-panel/types";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TContextCommandPanelItemsContext = {
  items: TCommandPanelItem[] | undefined;
  itemsPinned: TCommandPanelItem[] | undefined;
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
  triggerType: string;
  children: ReactNode;
}> = ({ teamId, projectId, page, context, triggerType, children }) => {
  const search = useCommandPanelStore((s) => s.search);
  const { environmentId } = useIdsFromPathname();

  const searchKey = useMemo(() => {
    if (page.usesAsyncSearch) {
      return search;
    }
    return null;
  }, [search, page.usesAsyncSearch]);

  const { data, isError, isPending, error } = useQuery({
    queryKey: [
      "context-aware-command-panel-items",
      teamId,
      projectId,
      environmentId,
      page.id,
      context,
      triggerType,
      searchKey,
      page.items !== undefined,
    ],
    queryFn: page.items ? () => page.items : () => page.getItems({ teamId, projectId, search }),
    enabled: page.items ? false : true,
  });

  const value: TContextCommandPanelItemsContext = useMemo(
    () => ({
      items: page.items ? page.items : data,
      itemsPinned: page.itemsPinned,
      isError: page.items ? false : isError,
      isPending: page.items ? false : isPending,
      error: page.items ? null : error,
    }),
    [data, error, isError, isPending, page.items, page.itemsPinned],
  );

  return (
    <ContextCommandPanelItemsContext.Provider value={value}>
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
