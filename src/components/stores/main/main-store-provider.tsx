"use client";

import { createMainStore, TMainStore } from "@/components/stores/main/main-store";
import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

export type TMainStoreContext = ReturnType<typeof createMainStore>;
export const MainStoreContext = createContext<TMainStoreContext | undefined>(undefined);

export interface MainStoreProviderProps {
  children: ReactNode;
}

export function MainStoreProvider({ children }: MainStoreProviderProps) {
  const storeRef = useRef<TMainStoreContext | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createMainStore();
  }

  return <MainStoreContext.Provider value={storeRef.current}>{children}</MainStoreContext.Provider>;
}

export function useMainStore<T>(selector: (store: TMainStore) => T): T {
  const context = useContext(MainStoreContext);

  if (!context) {
    throw new Error(`useMainStore must be used within MainStoreProvider`);
  }

  return useStore(context, selector);
}

export const defaultTemporaryEntityRemoveDelayMs = 1000 * 100;
export const defaultTemporaryEntityExpiryDurationMs = 1000 * 30;

export function useTemporarilyAddNewEntity(props?: {
  removeDelayMs?: number;
  expiryDurationMs?: number;
}) {
  const addNewlyCreatedEntity = useMainStore((s) => s.addNewlyCreatedEntity);
  const removeNewlyCreatedEntityWithDelay = useMainStore(
    (s) => s.removeNewlyCreatedEntityWithDelay,
  );

  const expiresAtTimestamp =
    props?.expiryDurationMs !== undefined
      ? props.expiryDurationMs
      : Date.now() + defaultTemporaryEntityExpiryDurationMs;

  const removeDelayMs =
    props?.removeDelayMs !== undefined ? props.removeDelayMs : defaultTemporaryEntityRemoveDelayMs;

  return (entityId: string) => {
    addNewlyCreatedEntity(entityId, expiresAtTimestamp);
    removeNewlyCreatedEntityWithDelay(entityId, removeDelayMs);
  };
}
