import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type {
  RegistryCacheConfig,
  RegistryCacheStats,
  SystemMetaResponseBody,
  SystemSettingsUpdateInput,
  UpdateRegistryCacheInput,
  UpdateStatusResponseBody,
} from "@/lib/server/client.gen";

export type TSystem = { data: SystemMetaResponseBody["data"] };
export type TUpdateStatus = { data: UpdateStatusResponseBody };
export type TRegistryStats = { data: RegistryCacheStats };
export type TRegistryConfig = { data: RegistryCacheConfig };

export const queryKeySystem = {
  get: () => ["system", "get"] as const,
  dnsCheck: (input: { domain: string }) => ["system", "dns", input.domain] as const,
  updateStatus: () => ["system", "update", "status"] as const,
  registry: () => ["system", "registry"] as const,
  registryStats: () => [...queryKeySystem.registry(), "stats"] as const,
  registryConfig: () => [...queryKeySystem.registry(), "config"] as const,
};

export const systemQuery = () =>
  queryOptions({
    queryKey: queryKeySystem.get(),
    queryFn: async (): Promise<TSystem> => {
      const res = await getGoClient().system.get();
      return { data: res.data };
    },
  });

export const dnsCheckQuery = (input: { domain: string }) =>
  queryOptions({
    queryKey: queryKeySystem.dnsCheck(input),
    queryFn: async () => {
      const res = await getGoClient().system.dns.check({ domain: input.domain });
      return { data: res.data };
    },
  });

export const updateStatusQuery = () =>
  queryOptions({
    queryKey: queryKeySystem.updateStatus(),
    queryFn: async (): Promise<TUpdateStatus> => {
      const res = await getGoClient().system.update.status();
      return { data: res };
    },
  });

export const registryStatsQuery = () =>
  queryOptions({
    queryKey: queryKeySystem.registryStats(),
    queryFn: async (): Promise<TRegistryStats> => {
      const res = await getGoClient().system.cache.registry.stats();
      return { data: res.data };
    },
  });

export const registryConfigQuery = () =>
  queryOptions({
    queryKey: queryKeySystem.registryConfig(),
    queryFn: async (): Promise<TRegistryConfig> => {
      const res = await getGoClient().system.cache.registry.config();
      return { data: res.data };
    },
  });

export async function updateRegistry(input: UpdateRegistryCacheInput) {
  const res = await getGoClient().system.cache.registry.update(input);
  return { data: res.data };
}

export async function startRegistryCleanup() {
  const res = await getGoClient().system.cache.registry.cleanup();
  return { data: res.data };
}

export async function updateSystemSettings(input: SystemSettingsUpdateInput) {
  const res = await getGoClient().system.settings.update(input);
  return { data: res.data };
}

export async function applyUpdate(targetVersion: string) {
  const res = await getGoClient().system.update.apply({ target_version: targetVersion });
  return { data: res };
}
