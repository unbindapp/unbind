"use client";

import { useAsyncRouterPush } from "@/lib/hooks/use-async-router-push";
import { createContext, ReactNode, useContext, useMemo } from "react";

type TAsyncPushContext = {
  isPending: boolean;
  asyncPush: (url: string) => Promise<void>;
};

const AsyncPushContext = createContext<TAsyncPushContext | null>(null);

export const AsyncPushProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [asyncPush, isPending] = useAsyncRouterPush();

  const value: TAsyncPushContext = useMemo(
    () => ({
      asyncPush,
      isPending,
    }),
    [asyncPush, isPending]
  );

  return (
    <AsyncPushContext.Provider value={value}>
      {children}
    </AsyncPushContext.Provider>
  );
};

export const useAsyncPush = () => {
  const context = useContext(AsyncPushContext);
  if (!context) {
    throw new Error("useAsyncPush must be used within an AsyncPushProvider");
  }
  return context;
};

export default AsyncPushProvider;
