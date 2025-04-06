"use client";

import {
  CommandPanelStore,
  createCommandPanelStore,
} from "@/components/command-panel/store/command-panel-store";
import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

export type CommandPanelStoreApi = ReturnType<typeof createCommandPanelStore>;
export const CommandPanelStoreContext = createContext<CommandPanelStoreApi | undefined>(undefined);

export interface CommandPanelStoreProviderProps {
  children: ReactNode;
}

export function CommandPanelStoreProvider({ children }: CommandPanelStoreProviderProps) {
  const storeRef = useRef<CommandPanelStoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createCommandPanelStore();
  }

  return (
    <CommandPanelStoreContext.Provider value={storeRef.current}>
      {children}
    </CommandPanelStoreContext.Provider>
  );
}

export function useCommandPanelStore<T>(selector: (store: CommandPanelStore) => T): T {
  const counterStoreContext = useContext(CommandPanelStoreContext);

  if (!counterStoreContext) {
    throw new Error(`useCommandPanelStore must be used within CommandPanelStoreProvider`);
  }

  return useStore(counterStoreContext, selector);
}
