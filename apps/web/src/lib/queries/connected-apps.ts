import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type {
  ConnectedAppApproveInput,
  ConnectedAppClientResponse,
  ConnectedAppDenyInput,
  ConnectedAppResponse,
} from "@/lib/server/client.gen";

export const queryKeyConnectedApps = {
  list: () => ["connected-apps", "list"] as const,
  client: (clientId: string, redirectUri: string) =>
    ["connected-apps", "client", clientId, redirectUri] as const,
};

export const connectedAppsListQuery = () =>
  queryOptions({
    queryKey: queryKeyConnectedApps.list(),
    queryFn: async () => {
      const res = await getGoClient().connectedApps.list(undefined);
      return { connectedApps: res.data };
    },
  });

// A refused client will not become valid by retrying, so the page fails fast
export const connectedAppClientQuery = ({
  clientId,
  redirectUri,
}: {
  clientId: string;
  redirectUri: string;
}) =>
  queryOptions({
    queryKey: queryKeyConnectedApps.client(clientId, redirectUri),
    queryFn: async () => {
      const res = await getGoClient().connectedApps.client({
        client_id: clientId,
        redirect_uri: redirectUri,
      });
      return { client: res.data };
    },
    staleTime: Infinity,
    retry: false,
  });

export async function approveConnectedApp(input: ConnectedAppApproveInput) {
  const res = await getGoClient().connectedApps.approve(input);
  return { data: res.data };
}

export async function denyConnectedApp(input: ConnectedAppDenyInput) {
  const res = await getGoClient().connectedApps.deny(input);
  return { data: res.data };
}

export async function revokeConnectedApp(input: { id: string }) {
  const res = await getGoClient().connectedApps.revoke({ id: input.id });
  return { data: res.data };
}

// ---- Types ----

export type TConnectedApp = ConnectedAppResponse;
export type TConnectedAppClient = ConnectedAppClientResponse;
export type TConnectedAppApproveInput = ConnectedAppApproveInput;
export type TConnectedAppDenyInput = ConnectedAppDenyInput;
