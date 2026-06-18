import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { WebhookEvent, WebhookResponse } from "@/server/client.gen";

export type TWebhookShallow = WebhookResponse;

export type TWebhooksListInput =
  | { type: "project"; teamId: string; projectId: string }
  | { type: "team"; teamId: string };

export const webhooksListQuery = (input: TWebhooksListInput) =>
  queryOptions({
    queryKey: queryKeys.webhooks.list(input),
    queryFn: async () => {
      const res = await getGoClient().unbindwebhooks.list(
        input.type === "project"
          ? { type: "project", team_id: input.teamId, project_id: input.projectId }
          : { type: "team", team_id: input.teamId },
      );
      return { webhooks: res.data };
    },
  });

export type TCreateWebhookInput =
  | { type: "project"; teamId: string; projectId: string; url: string; events: WebhookEvent[] }
  | { type: "team"; teamId: string; url: string; events: WebhookEvent[] };

export async function createWebhook(input: TCreateWebhookInput) {
  const res = await getGoClient().unbindwebhooks.create(
    input.type === "project"
      ? {
          type: "project",
          team_id: input.teamId,
          project_id: input.projectId,
          url: input.url,
          events: input.events,
        }
      : { type: "team", team_id: input.teamId, url: input.url, events: input.events },
  );
  return { data: res.data };
}

export type TDeleteWebhookInput =
  | { type: "project"; id: string; teamId: string; projectId: string }
  | { type: "team"; id: string; teamId: string };

export async function deleteWebhook(input: TDeleteWebhookInput) {
  const res = await getGoClient().unbindwebhooks.delete(
    input.type === "project"
      ? { type: "project", id: input.id, team_id: input.teamId, project_id: input.projectId }
      : { type: "team", id: input.id, team_id: input.teamId },
  );
  return { data: res.data };
}
