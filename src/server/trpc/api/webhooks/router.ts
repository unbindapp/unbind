import { WebhookEventSchema, WebhookTypeSchema } from "@/server/go/client.gen";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";

import { z } from "zod";

export const webhooksRouter = createTRPCRouter({
  list: privateProcedure
    .input(
      z.discriminatedUnion("type", [
        z
          .object({
            type: z.literal(WebhookTypeSchema.Enum.project),
            teamId: z.string().uuid(),
            projectId: z.string().uuid(),
          })
          .strip(),
        z
          .object({
            type: z.literal(WebhookTypeSchema.Enum.team),
            teamId: z.string().uuid(),
          })
          .strip(),
      ]),
    )
    .query(async function ({ input, ctx: { goClient } }) {
      const res = await goClient.unbindwebhooks.list(
        input.type === WebhookTypeSchema.Enum.project
          ? {
              type: WebhookTypeSchema.Enum.project,
              team_id: input.teamId,
              project_id: input.projectId,
            }
          : {
              type: WebhookTypeSchema.Enum.team,
              team_id: input.teamId,
            },
      );
      return {
        webhooks: res.data,
      };
    }),
  create: privateProcedure
    .input(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal(WebhookTypeSchema.Enum.project),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          url: z.string().url(),
          events: z.set(WebhookEventSchema).min(1, "Select at least one event."),
        }),
        z.object({
          type: z.literal(WebhookTypeSchema.Enum.team),
          teamId: z.string().uuid(),
          url: z.string().url(),
          events: z.set(WebhookEventSchema).min(1, "Select at least one event."),
        }),
      ]),
    )
    .mutation(async function ({ input, ctx: { goClient } }) {
      const res = await goClient.unbindwebhooks.create(
        input.type === WebhookTypeSchema.Enum.project
          ? {
              type: WebhookTypeSchema.Enum.project,
              team_id: input.teamId,
              project_id: input.projectId,
              url: input.url,
              events: Array.from(input.events),
            }
          : {
              type: WebhookTypeSchema.Enum.team,
              team_id: input.teamId,
              url: input.url,
              events: Array.from(input.events),
            },
      );
      return {
        data: res.data,
      };
    }),
  delete: privateProcedure
    .input(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal(WebhookTypeSchema.Enum.project),
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        }),
        z.object({
          type: z.literal(WebhookTypeSchema.Enum.team),
          id: z.string().uuid(),
          teamId: z.string().uuid(),
        }),
      ]),
    )
    .mutation(async function ({ input, ctx: { goClient } }) {
      const res = await goClient.unbindwebhooks.delete(
        input.type === WebhookTypeSchema.Enum.project
          ? {
              type: WebhookTypeSchema.Enum.project,
              id: input.id,
              team_id: input.teamId,
              project_id: input.projectId,
            }
          : {
              type: WebhookTypeSchema.Enum.team,
              id: input.id,
              team_id: input.teamId,
            },
      );
      return {
        data: res.data,
      };
    }),
});
