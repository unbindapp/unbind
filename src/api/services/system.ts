import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import type {
  SystemMetaResponseBody,
  UpdateCheckResponseBody,
  UpdateStatusResponseBody,
} from "@/server/go/client.gen";

export type TSystem = { data: SystemMetaResponseBody["data"] };
export type TCheckForUpdates = { data: UpdateCheckResponseBody };
export type TUpdateStatus = { data: UpdateStatusResponseBody };

export const systemQuery = () =>
  queryOptions({
    queryKey: queryKeys.system.get(),
    queryFn: async (): Promise<TSystem> => {
      const res = await getGoClient().system.get();
      return { data: res.data };
    },
  });

export const dnsCheckQuery = (domain: string) =>
  queryOptions({
    queryKey: queryKeys.system.dnsCheck(domain),
    queryFn: async () => {
      const res = await getGoClient().system.dns.check({ domain });
      return { data: res.data };
    },
  });

export const checkForUpdatesQuery = () =>
  queryOptions({
    queryKey: queryKeys.system.updateCheck(),
    queryFn: async (): Promise<TCheckForUpdates> => {
      const res = await getGoClient().system.update.check();
      return { data: res };
    },
  });

export const checkUpdateStatusQuery = () =>
  queryOptions({
    queryKey: queryKeys.system.updateStatus(),
    queryFn: async (): Promise<TUpdateStatus> => {
      const res = await getGoClient().system.update.status();
      return { data: res };
    },
  });

export async function applyUpdate(targetVersion: string) {
  const res = await getGoClient().system.update.apply({ target_version: targetVersion });
  return { data: res };
}
