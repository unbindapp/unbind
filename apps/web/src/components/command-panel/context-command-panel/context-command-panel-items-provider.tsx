"use client";

import { TCommandPanelItemsContext } from "@/components/command-panel/command-panel-items-provier";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import { TCommandPanelPage, TContextCommandPanelContext } from "@/components/command-panel/types";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext, useMemo } from "react";

const ContextCommandPanelItemsContext = createContext<TCommandPanelItemsContext | null>(null);

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
    if (page.usesSearchAsync) {
      return search;
    }
    return null;
  }, [search, page.usesSearchAsync]);

  const queryKey = useMemo(
    () =>
      getContextCommandPaneItemsQueryKey({
        teamId,
        projectId,
        environmentId,
        pageId: page.id,
        context,
        triggerType,
        searchKey,
        hasItems: page.items !== undefined,
      }),
    [teamId, projectId, environmentId, page.id, page.items, context, triggerType, searchKey],
  );

  const { data, isError, isPending, error } = useQuery({
    queryKey: queryKey,
    queryFn: () => page.getItemsAsync?.({ teamId, projectId, search }),
    enabled: !page.getItemsAsync ? false : true,
  });

  const searchKeyForItems = useMemo(
    () => (page.getItems && page.disableCommandFilter ? search : null),
    [page.getItems, page.disableCommandFilter, search],
  );

  const items = useMemo(() => {
    if (page.items) {
      return page.items;
    }
    if (page.getItems) {
      return page.getItems({ teamId, projectId, search });
    }
    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.items, page.getItems, data, teamId, projectId, searchKeyForItems]);

  const isErrorConditional = useMemo(() => {
    if (page.items || page.getItems) {
      return false;
    }
    return isError;
  }, [page.items, page.getItems, isError]);

  const errorConditional = useMemo(() => {
    if (page.items || page.getItems) {
      return null;
    }
    return error;
  }, [page.items, page.getItems, error]);

  const isPendingConditional = useMemo(() => {
    if (page.items || page.getItems) {
      return false;
    }
    return isPending;
  }, [page.items, page.getItems, isPending]);

  const value: TCommandPanelItemsContext = useMemo(
    () => ({
      items,
      itemsPinned: page.itemsPinned,
      isPending: isPendingConditional,
      isError: isErrorConditional,
      error: errorConditional,
    }),
    [items, page.itemsPinned, isPendingConditional, isErrorConditional, errorConditional],
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

export function getContextCommandPaneItemsQueryKey({
  teamId,
  projectId,
  environmentId,
  pageId,
  context,
  triggerType,
  searchKey,
  hasItems,
}: {
  teamId: string;
  projectId: string;
  environmentId: string | null;
  pageId: string;
  context: TContextCommandPanelContext;
  triggerType: string;
  searchKey: string | null;
  hasItems: boolean;
}) {
  return [
    "context-aware-command-panel-items",
    teamId,
    projectId,
    environmentId,
    pageId,
    context,
    triggerType,
    searchKey,
    hasItems,
  ];
}
