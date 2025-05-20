"use client";

import { createUpdateStore, TUpdateStore } from "@/components/update/update-store";
import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

export type TUpdateStoreContext = ReturnType<typeof createUpdateStore>;
export const UpdateStoreContext = createContext<TUpdateStoreContext | undefined>(undefined);

export interface UpdateStoreProviderProps {
  children: ReactNode;
}

export function UpdateStoreProvider({ children }: UpdateStoreProviderProps) {
  const storeRef = useRef<TUpdateStoreContext | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createUpdateStore();
  }

  return (
    <UpdateStoreContext.Provider value={storeRef.current}>{children}</UpdateStoreContext.Provider>
  );
}

export function useUpdateStore<T>(selector: (store: TUpdateStore) => T): T {
  const context = useContext(UpdateStoreContext);

  if (!context) {
    throw new Error(`useUpdateStore must be used within UpdateStoreProvider`);
  }

  return useStore(context, selector);
}
