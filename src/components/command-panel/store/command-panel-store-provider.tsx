"use client";

import {
  CommandPanelStore,
  createCommandPanelStore,
} from "@/components/command-panel/store/command-panel-store";
import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

export type TCommandPanelStoreContext = ReturnType<typeof createCommandPanelStore>;
export const CommandPanelStoreContext = createContext<TCommandPanelStoreContext | undefined>(
  undefined,
);

export interface CommandPanelStoreProviderProps {
  children: ReactNode;
}

export function CommandPanelStoreProvider({ children }: CommandPanelStoreProviderProps) {
  const storeRef = useRef<TCommandPanelStoreContext | null>(null);
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
  const context = useContext(CommandPanelStoreContext);

  if (!context) {
    throw new Error(`useCommandPanelStore must be used within CommandPanelStoreProvider`);
  }

  return useStore(context, selector);
}
