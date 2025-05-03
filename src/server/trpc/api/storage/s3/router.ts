import { CreateS3SourceFormSchema } from "@/server/trpc/api/storage/s3/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const s3Router = createTRPCRouter({
  get: privateProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          withBuckets: z.boolean().default(true).optional(),
        })
        .strip(),
    )
    .query(async function ({ input: { id, teamId, withBuckets }, ctx: { goClient } }) {
      const res = await goClient.storage.s3.get({ id, team_id: teamId, with_buckets: withBuckets });
      return {
        source: res.data,
      };
    }),
  list: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          withBuckets: z.boolean().optional().default(true),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId, withBuckets }, ctx: { goClient } }) {
      const res = await goClient.storage.s3.list({ team_id: teamId, with_buckets: withBuckets });
      return {
        sources: res.data,
      };
    }),
  create: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
        })
        .merge(CreateS3SourceFormSchema)
        .strip(),
    )
    .mutation(async function ({
      input: { teamId, endpoint, accessKeyId, secretKey, name, region },
      ctx: { goClient },
    }) {
      const res = await goClient.storage.s3.create({
        team_id: teamId,
        endpoint,
        access_key_id: accessKeyId,
        secret_key: secretKey,
        name,
        region,
      });
      return {
        data: res.data,
      };
    }),
  update: privateProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
          name: CreateS3SourceFormSchema.shape.name,
        })
        .strip(),
    )
    .mutation(async function ({ input: { id, teamId, name }, ctx: { goClient } }) {
      const res = await goClient.storage.s3.update({
        id,
        team_id: teamId,
        name,
      });
      return {
        data: res.data,
      };
    }),
  delete: privateProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          teamId: z.string().uuid(),
        })
        .strip(),
    )
    .mutation(async function ({ input: { id, teamId }, ctx: { goClient } }) {
      const res = await goClient.storage.s3.delete({
        id,
        team_id: teamId,
      });
      return {
        data: res.data,
      };
    }),
  test: privateProcedure
    .input(
      z
        .object({
          endpoint: z.string(),
          accessKeyId: z.string(),
          secretKey: z.string(),
          region: z.string(),
        })
        .strip(),
    )
    .query(async function ({
      input: { endpoint, accessKeyId, secretKey, region },
      ctx: { goClient },
    }) {
      const res = await goClient.storage.s3.test({
        endpoint,
        access_key_id: accessKeyId,
        secret_key: secretKey,
        region,
      });
      return {
        data: res.data,
      };
    }),
});
