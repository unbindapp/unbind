"use client";

import { queryKeys } from "@/lib/queries/query-keys";
import { webhooksListQuery, type TWebhookShallow } from "@/lib/queries/webhooks";
import { TWebhookTypeProject, TWebhookTypeTeam } from "@/server/types/webhooks";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { createContext, ReactNode, useContext } from "react";

export type TWebhooksResult = { webhooks: TWebhookShallow[] };
type TWebhooksContext = UseQueryResult<TWebhooksResult, Error>;

const WebhooksContext = createContext<TWebhooksContext | null>(null);

type TProjectWebhooks = {
  type: TWebhookTypeProject;
  teamId: string;
  projectId: string;
};

type TTeamWebhooks = {
  type: TWebhookTypeTeam;
  teamId: string;
  projectId?: never;
};

type TWebhooksProviderProps = {
  initialData?: TWebhooksResult;
  children: ReactNode;
} & (TProjectWebhooks | TTeamWebhooks);

export const WebhooksProvider: React.FC<TWebhooksProviderProps> = ({
  children,
  initialData,
  ...rest
}) => {
  const query = useQuery({ ...webhooksListQuery(rest), initialData });
  return <WebhooksContext.Provider value={query}>{children}</WebhooksContext.Provider>;
};

export const useWebhooks = () => {
  const context = useContext(WebhooksContext);
  if (!context) {
    throw new Error("useWebhooks must be used within an WebhooksProvider");
  }
  return context;
};

export const useWebhooksUtils = (params: TProjectWebhooks | TTeamWebhooks) => {
  const queryClient = useQueryClient();
  return {
    invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(params) }),
  };
};

export default WebhooksProvider;
