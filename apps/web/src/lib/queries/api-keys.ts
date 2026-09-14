import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type {
  APIKeyCreateInput,
  APIKeyCreatedResponse,
  APIKeyResponse,
} from "@/lib/server/client.gen";

export const queryKeyApiKeys = {
  list: () => ["api-keys", "list"] as const,
};

export const apiKeysListQuery = () =>
  queryOptions({
    queryKey: queryKeyApiKeys.list(),
    queryFn: async () => {
      const res = await getGoClient().apiKeys.list({});
      return { apiKeys: res.data };
    },
  });

export async function createApiKey(input: APIKeyCreateInput) {
  const res = await getGoClient().apiKeys.create(input);
  return { data: res.data };
}

export async function deleteApiKey(input: { id: string }) {
  const res = await getGoClient().apiKeys.delete({ id: input.id });
  return { data: res.data };
}

// ---- Types ----

export type TApiKeyShallow = APIKeyResponse;
export type TApiKeyCreated = APIKeyCreatedResponse;
export type TApiKeyCreateInput = APIKeyCreateInput;
