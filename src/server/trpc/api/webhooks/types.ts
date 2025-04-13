import { z } from "zod";

export const WebhookTypeProject = z.literal("project");
export const WebhookTypeTeam = z.literal("team");
export const WebhookTypeEnum = z.enum([WebhookTypeProject.value, WebhookTypeTeam.value]);

export type TWebhookTypeProject = z.infer<typeof WebhookTypeProject>;
export type TWebhookTypeTeam = z.infer<typeof WebhookTypeTeam>;
export type TWebhookTypeEnum = z.infer<typeof WebhookTypeEnum>;

export const WebhookIdProjectEnum = z.enum([
  "service.created",
  "service.updated",
  "service.deleted",
  "deployment.queued",
  "deployment.building",
  "deployment.succeeded",
  "deployment.failed",
  "deployment.cancelled",
]);

export const WebhookIdTeamEnum = z.enum(["project.created", "project.updated", "project.deleted"]);

export type TWebhookIdProjectEnum = z.infer<typeof WebhookIdProjectEnum>;
export type TWebhookIdTeamEnum = z.infer<typeof WebhookIdTeamEnum>;
