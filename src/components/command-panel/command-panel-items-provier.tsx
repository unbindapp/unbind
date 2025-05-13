import { TCommandPanelItem } from "@/components/command-panel/types";
import { createContext, ReactNode, useContext } from "react";

export type TCommandPanelItemsContext = {
  items: TCommandPanelItem[] | undefined;
  itemsPinned: TCommandPanelItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const CommandPanelItemsContext = createContext<TCommandPanelItemsContext | null>(null);

export const CommandPanelItemsProvider: React.FC<{
  useCommandPanelItems: () => TCommandPanelItemsContext;
  children: ReactNode;
}> = ({ useCommandPanelItems, children }) => {
  const value = useCommandPanelItems();
  return (
    <CommandPanelItemsContext.Provider value={value}>{children}</CommandPanelItemsContext.Provider>
  );
};

export const useCommandPanelItems = () => {
  const context = useContext(CommandPanelItemsContext);
  if (!context) {
    throw new Error("useCommandPanelItems must be used within an CommandPanelItemsProvider");
  }
  return context;
};
