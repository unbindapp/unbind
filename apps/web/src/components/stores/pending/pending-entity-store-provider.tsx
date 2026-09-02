"use client";

import {
  createPendingEntityStore,
  TPendingEntityStore,
} from "@/components/stores/pending/pending-entity-store";
import { type ReactNode, createContext, useContext, useRef } from "react";
import { useStore } from "zustand";

export type TPendingEntityStoreContext = ReturnType<typeof createPendingEntityStore>;
export const PendingEntityStoreContext = createContext<TPendingEntityStoreContext | undefined>(
  undefined,
);

export function PendingEntityStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<TPendingEntityStoreContext | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createPendingEntityStore();
  }

  return (
    <PendingEntityStoreContext.Provider value={storeRef.current}>
      {children}
    </PendingEntityStoreContext.Provider>
  );
}

export function usePendingEntityStore<T>(selector: (store: TPendingEntityStore) => T): T {
  const context = useContext(PendingEntityStoreContext);

  if (!context) {
    throw new Error(`usePendingEntityStore must be used within PendingEntityStoreProvider`);
  }

  return useStore(context, selector);
}
