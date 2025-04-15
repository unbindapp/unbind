import {
  WebhookProjectEventSchema,
  WebhookTeamEventSchema,
  WebhookTypeSchema,
} from "@/server/go/client.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export type TWebhookTypeProject = (typeof WebhookTypeSchema)["Enum"]["project"];
export type TWebhookTypeTeam = (typeof WebhookTypeSchema)["Enum"]["team"];
export type TWebhookTypeEnum = z.infer<typeof WebhookTypeSchema>;

export type TWebhookIdProjectEnum = z.infer<typeof WebhookProjectEventSchema>;
export type TWebhookIdTeamEnum = z.infer<typeof WebhookTeamEventSchema>;
export const WebhookIdProjectEnum = WebhookProjectEventSchema;
export const WebhookIdTeamEnum = WebhookTeamEventSchema;

export type TWebhookShallow = AppRouterOutputs["webhooks"]["list"]["webhooks"][number];
