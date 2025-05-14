"use client";

import {
  createTemplateDraftStore,
  TTemplateDraftStore,
} from "@/components/templates/template-draft-store";
import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

export type TTemplateDraftStoreContext = ReturnType<typeof createTemplateDraftStore>;
export const TemplateDraftStoreContext = createContext<TTemplateDraftStoreContext | undefined>(
  undefined,
);

export interface TemplateDraftStoreProviderProps {
  children: ReactNode;
}

export function TemplateDraftStoreProvider({ children }: TemplateDraftStoreProviderProps) {
  const storeRef = useRef<TTemplateDraftStoreContext | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createTemplateDraftStore();
  }

  return (
    <TemplateDraftStoreContext.Provider value={storeRef.current}>
      {children}
    </TemplateDraftStoreContext.Provider>
  );
}

export function useTemplateDraftStore<T>(selector: (store: TTemplateDraftStore) => T): T {
  const context = useContext(TemplateDraftStoreContext);

  if (!context) {
    throw new Error(`useTemplateDraftStore must be used within TemplateDraftStoreProvider`);
  }

  return useStore(context, selector);
}
