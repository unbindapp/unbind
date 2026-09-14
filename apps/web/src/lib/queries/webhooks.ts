import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import {
  WebhookProjectEventSchema,
  WebhookTeamEventSchema,
  WebhookTypeSchema,
} from "@/lib/server/client.gen";
import type { WebhookEvent, WebhookResponse } from "@/lib/server/client.gen";

export type TWebhooksListInput =
  | { type: "project"; teamId: string; projectId: string }
  | { type: "team"; teamId: string };

export const queryKeyWebhooks = {
  list: (input: { type: "project" | "team"; teamId: string; projectId?: string }) =>
    input.type === "project"
      ? (["webhooks", "list", "project", input.teamId, input.projectId] as const)
      : (["webhooks", "list", "team", input.teamId] as const),
};

export const webhooksListQuery = (input: TWebhooksListInput) =>
  queryOptions({
    queryKey: queryKeyWebhooks.list(input),
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

// ---- Types ----

export type TWebhookShallow = WebhookResponse;

export type TWebhookTypeProject = (typeof WebhookTypeSchema)["Enum"]["project"];
export type TWebhookTypeTeam = (typeof WebhookTypeSchema)["Enum"]["team"];
export type TWebhookTypeEnum = z.infer<typeof WebhookTypeSchema>;

export type TWebhookIdProjectEnum = z.infer<typeof WebhookProjectEventSchema>;
export type TWebhookIdTeamEnum = z.infer<typeof WebhookTeamEventSchema>;
export const WebhookIdProjectEnum = WebhookProjectEventSchema;
export const WebhookIdTeamEnum = WebhookTeamEventSchema;
