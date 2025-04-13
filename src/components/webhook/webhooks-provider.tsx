"use client";

import { AppRouterOutputs, AppRouterQueryResult } from "@/server/trpc/api/root";
import { TWebhookTypeProject, TWebhookTypeTeam } from "@/server/trpc/api/webhooks/types";
import { api } from "@/server/trpc/setup/client";
import { createContext, ReactNode, useContext } from "react";

type TWebhooksContext = AppRouterQueryResult<AppRouterOutputs["webhooks"]["list"]>;

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

export const WebhooksProvider: React.FC<
  {
    children: ReactNode;
  } & (TProjectWebhooks | TTeamWebhooks)
> = ({ children, ...rest }) => {
  const query = api.webhooks.list.useQuery({ ...rest });
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
  const utils = api.useUtils();
  return {
    invalidate: () => utils.webhooks.list.invalidate({ ...params }),
  };
};

export default WebhooksProvider;
