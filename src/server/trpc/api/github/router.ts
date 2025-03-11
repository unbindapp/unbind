import {
  GitHubConnectAppResponseSchema,
  GitHubCreateManifestResponseSchema,
} from "@/server/trpc/api/github/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const apiUrl = "https://api.unbind.app";

export const githubRouter = createTRPCRouter({
  createManifest: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        redirectUrl: z.string(),
      }),
    )
    .mutation(async function ({ input: { teamId, redirectUrl }, ctx }) {
      console.log("Create GitHub manifest for team:", teamId);
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        });
      }

      const res = await fetch(`${apiUrl}/github/app/manifest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redirect_url: redirectUrl,
        }),
      });

      const resJson = await res.json();

      const data = GitHubCreateManifestResponseSchema.parse(resJson);

      return {
        data,
      };
    }),
  connectApp: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        code: z.string(),
      }),
    )
    .mutation(async function ({ input: { teamId, code }, ctx }) {
      console.log("Connect GitHub app for team:", teamId);
      const { session } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        });
      }

      const res = await fetch(`${apiUrl}/github/app/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
        }),
      });

      const resJson = await res.json();

      const data = GitHubConnectAppResponseSchema.parse(resJson);

      return {
        data,
      };
    }),
});
