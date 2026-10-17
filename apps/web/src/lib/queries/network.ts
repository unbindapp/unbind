import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type {
  CreateNetworkExceptionInput,
  NetworkExceptionResponse,
  NetworkServiceResponse,
} from "@/lib/server/client.gen";

export const queryKeyNetwork = {
  settings: () => ["system", "network"] as const,
  services: () => ["system", "network", "services"] as const,
};

export type TNetworkException = NetworkExceptionResponse;
export type TNetworkService = NetworkServiceResponse;

export const networkSettingsQuery = () =>
  queryOptions({
    queryKey: queryKeyNetwork.settings(),
    queryFn: async () => {
      const res = await getGoClient().system.network.get();
      return { data: res.data };
    },
  });

export const networkServicesQuery = () =>
  queryOptions({
    queryKey: queryKeyNetwork.services(),
    queryFn: async () => {
      const res = await getGoClient().system.network.services();
      return { data: res.data };
    },
  });

export async function updateNetworkSettings(input: { team_network_isolation: boolean }) {
  const res = await getGoClient().system.network.update(input);
  return { data: res.data };
}

export async function createNetworkException(input: CreateNetworkExceptionInput) {
  const res = await getGoClient().system.network.exceptions.create(input);
  return { data: res.data };
}

export async function deleteNetworkException(input: { id: string }) {
  await getGoClient().system.network.exceptions.delete(input);
}
