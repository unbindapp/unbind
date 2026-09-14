"use client";

import { apiKeysListQuery, queryKeyApiKeys, type TApiKeyShallow } from "@/lib/queries/api-keys";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

export type TApiKeysResult = { apiKeys: TApiKeyShallow[] };
type TApiKeysContext = UseQueryResult<TApiKeysResult, Error>;

const ApiKeysContext = createContext<TApiKeysContext | null>(null);

export const ApiKeysProvider: React.FC<{ initialData?: TApiKeysResult; children: ReactNode }> = ({
  children,
  initialData,
}) => {
  const query = useQuery({ ...apiKeysListQuery(), initialData });
  return <ApiKeysContext.Provider value={query}>{children}</ApiKeysContext.Provider>;
};

export const useApiKeys = () => {
  const context = useContext(ApiKeysContext);
  if (!context) {
    throw new Error("useApiKeys must be used within an ApiKeysProvider");
  }
  return context;
};

export const useApiKeysUtils = () => {
  const queryClient = useQueryClient();
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeyApiKeys.list() }),
  };
};

export default ApiKeysProvider;
