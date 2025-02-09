"use client";

import { useAsyncRouterPush } from "@/lib/hooks/use-async-router-push";
import { createContext, ReactNode, useContext } from "react";

type TAsyncPushContext = {
  isPending: boolean;
  asyncPush: (url: string) => Promise<void>;
};

const AsyncPushContext = createContext<TAsyncPushContext | null>(null);

export const AsyncPushProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [asyncPush, isPending] = useAsyncRouterPush();
  return (
    <AsyncPushContext.Provider
      value={{
        asyncPush,
        isPending,
      }}
    >
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
