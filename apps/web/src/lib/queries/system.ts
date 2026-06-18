import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type {
  SystemMetaResponseBody,
  UpdateCheckResponseBody,
  UpdateStatusResponseBody,
} from "@/lib/server/client.gen";

export type TSystem = { data: SystemMetaResponseBody["data"] };
export type TCheckForUpdates = { data: UpdateCheckResponseBody };
export type TUpdateStatus = { data: UpdateStatusResponseBody };

export const queryKeySystem = {
  get: () => ["system", "get"] as const,
  dnsCheck: (input: { domain: string }) => ["system", "dns", input.domain] as const,
  updateCheck: () => ["system", "update", "check"] as const,
  updateStatus: () => ["system", "update", "status"] as const,
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

export const checkForUpdatesQuery = () =>
  queryOptions({
    queryKey: queryKeySystem.updateCheck(),
    queryFn: async (): Promise<TCheckForUpdates> => {
      const res = await getGoClient().system.update.check();
      return { data: res };
    },
  });

export const checkUpdateStatusQuery = () =>
  queryOptions({
    queryKey: queryKeySystem.updateStatus(),
    queryFn: async (): Promise<TUpdateStatus> => {
      const res = await getGoClient().system.update.status();
      return { data: res };
    },
  });

export async function applyUpdate(targetVersion: string) {
  const res = await getGoClient().system.update.apply({ target_version: targetVersion });
  return { data: res };
}
