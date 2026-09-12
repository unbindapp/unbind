import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type { GetServerResponseBody, ListServersResponseBody } from "@/lib/server/client.gen";

export type TServer = ListServersResponseBody["data"][number];
export type TServerDetail = GetServerResponseBody["data"];
export type TServerCondition = TServer["conditions"][number];
export type TServerConditionType = TServerCondition["type"];
export type TServers = { data: TServer[] };

export const queryKeyServers = {
  list: () => ["servers", "list"] as const,
  get: (name: string) => ["servers", "get", name] as const,
};

export const serversListQuery = () =>
  queryOptions({
    queryKey: queryKeyServers.list(),
    queryFn: async (): Promise<TServers> => {
      const res = await getGoClient().servers.list();
      return { data: res.data };
    },
    refetchInterval: 30 * 1000,
  });

export const serverQuery = ({ name }: { name: string }) =>
  queryOptions({
    queryKey: queryKeyServers.get(name),
    queryFn: async (): Promise<TServerDetail> => {
      const res = await getGoClient().servers.get({ name });
      return res.data;
    },
    refetchInterval: 30 * 1000,
  });
