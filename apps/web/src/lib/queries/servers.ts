import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type { ListServersResponseBody } from "@/lib/server/client.gen";

export type TServer = ListServersResponseBody["data"][number];
export type TServers = { data: TServer[] };

export const queryKeyServers = {
  list: () => ["servers", "list"] as const,
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
