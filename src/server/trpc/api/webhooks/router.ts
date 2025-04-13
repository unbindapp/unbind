import {
  TWebhookIdProjectEnum,
  WebhookIdProjectEnum,
  WebhookIdTeamEnum,
  WebhookTypeProject,
  WebhookTypeTeam,
} from "@/server/trpc/api/webhooks/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const webhooksRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.discriminatedUnion("type", [
        z
          .object({
            type: WebhookTypeProject,
            teamId: z.string().uuid(),
            projectId: z.string().uuid(),
          })
          .strip(),
        z
          .object({
            type: WebhookTypeTeam,
            teamId: z.string().uuid(),
          })
          .strip(),
      ]),
    )
    .query(async function ({ ctx }) {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const res: {
        id: string;
        url: string;
        events: TWebhookIdProjectEnum[];
        created_at: string;
      }[] = [
        {
          id: "6e3bddbb-0a0d-4147-8a1f-3cd33cd12cf6",
          url: "https://discord.com/api/webhooks/1234123412341234/asdfasdf_ASDFASDFASDFASDFSDF",
          events: [
            "deployment.queued",
            "deployment.building",
            "deployment.succeeded",
            "deployment.failed",
            "deployment.cancelled",
          ],
          created_at: new Date().toISOString(),
        },
        {
          id: "55d654a4-133b-419f-aacc-0dbe5c364663",
          url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
          events: ["service.created", "service.updated", "service.deleted", "deployment.queued"],
          created_at: new Date().toISOString(),
        },
        {
          id: "6e3bddbb-0a0d-4147-8a1f-3cd33cd12caa",
          url: "https://test.com/webhook",
          events: ["service.created", "service.updated", "service.deleted"],
          created_at: new Date().toISOString(),
        },
      ];
      return {
        webhooks: res,
      };
    }),
  create: publicProcedure
    .input(
      z.discriminatedUnion("type", [
        z.object({
          type: WebhookTypeProject,
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          url: z.string().url(),
          events: z.set(WebhookIdProjectEnum).min(1, "Select at least one event."),
        }),
        z.object({
          type: WebhookTypeTeam,
          teamId: z.string().uuid(),
          url: z.string().url(),
          events: z.set(WebhookIdTeamEnum).min(1, "Select at least one event."),
        }),
      ]),
    )
    .mutation(async function ({ input, ctx }) {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      return {
        id: "a6c8e1d6-9772-45af-858c-33fafa32b154",
        url: input.url,
        events: Array.from(input.events),
      };
    }),
  delete: publicProcedure
    .input(
      z.discriminatedUnion("type", [
        z.object({
          type: WebhookTypeProject,
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
        }),
        z.object({
          type: WebhookTypeTeam,
          id: z.string().uuid(),
          teamId: z.string().uuid(),
        }),
      ]),
    )
    .mutation(async function ({ input, ctx }) {
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      return {
        id: input.id,
      };
    }),
});
