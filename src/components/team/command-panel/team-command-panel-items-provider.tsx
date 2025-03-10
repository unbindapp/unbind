"use client";

import { TCommandPanelItem, TCommandPanelPage } from "@/components/command-panel/types";
import { useQuery } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

type TTeamCommandPanelItemsContext = {
  items: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const TeamCommandPanelItemsContext = createContext<TTeamCommandPanelItemsContext | null>(null);

export const TeamCommandPanelItemsProvider: React.FC<{
  teamId: string;
  page: TCommandPanelPage;
  children: ReactNode;
}> = ({ teamId, page, children }) => {
  const { data, isError, isPending, error } = useQuery({
    queryKey: ["team-command-panel", teamId, page.id],
    queryFn: page.items ? () => page.items : () => page.getItems({ teamId, projectId: "" }),
    enabled: page.items ? false : true,
  });

  return (
    <TeamCommandPanelItemsContext.Provider
      value={{
        items: page.items ? page.items : data,
        isError: page.items ? false : isError,
        isPending: page.items ? false : isPending,
        error: page.items ? null : error,
      }}
    >
      {children}
    </TeamCommandPanelItemsContext.Provider>
  );
};

export const useTeamCommandPanelItems = () => {
  const context = useContext(TeamCommandPanelItemsContext);
  if (!context) {
    throw new Error(
      "useTeamCommandPanelItems must be used within an TeamCommandPanelItemsProvider",
    );
  }
  return context;
};

export default TeamCommandPanelItemsProvider;
