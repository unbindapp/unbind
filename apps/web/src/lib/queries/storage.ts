import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import { PvcScopeSchema } from "@/lib/server/client.gen";
import type { PvcScope, S3Response } from "@/lib/server/client.gen";

export const queryKeyStorage = {
  s3List: (input: { teamId: string }) => ["storage", "s3", "list", input.teamId] as const,
  s3Detail: (input: { teamId: string; id: string }) =>
    ["storage", "s3", "detail", input.teamId, input.id] as const,
  volume: (input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    type: string;
    id: string;
  }) =>
    [
      "storage",
      "volume",
      input.teamId,
      input.projectId,
      input.environmentId,
      input.type,
      input.id,
    ] as const,
};

// ---- S3 sources ----

export const s3SourcesListQuery = (input: { teamId: string; withBuckets?: boolean }) =>
  queryOptions({
    queryKey: queryKeyStorage.s3List(input),
    queryFn: async () => {
      const res = await getGoClient().storage.s3.list({
        team_id: input.teamId,
        with_buckets: input.withBuckets ?? true,
      });
      return { sources: res.data };
    },
  });

export const s3SourceQuery = (input: { id: string; teamId: string; withBuckets?: boolean }) =>
  queryOptions({
    queryKey: queryKeyStorage.s3Detail(input),
    queryFn: async () => {
      const res = await getGoClient().storage.s3.get({
        id: input.id,
        team_id: input.teamId,
        with_buckets: input.withBuckets ?? true,
      });
      return { source: res.data };
    },
  });

export async function createS3Source(input: {
  teamId: string;
  name: string;
  endpoint: string;
  accessKeyId: string;
  secretKey: string;
  region: string;
}) {
  const res = await getGoClient().storage.s3.create({
    team_id: input.teamId,
    endpoint: input.endpoint,
    access_key_id: input.accessKeyId,
    secret_key: input.secretKey,
    name: input.name,
    region: input.region,
  });
  return { data: res.data };
}

export async function updateS3Source(input: { id: string; teamId: string; name: string }) {
  const res = await getGoClient().storage.s3.update({
    id: input.id,
    team_id: input.teamId,
    name: input.name,
  });
  return { data: res.data };
}

export async function deleteS3Source(input: { id: string; teamId: string }) {
  const res = await getGoClient().storage.s3.delete({ id: input.id, team_id: input.teamId });
  return { data: res.data };
}

export const testS3Query = (input: {
  endpoint: string;
  accessKeyId: string;
  secretKey: string;
  region: string;
}) =>
  queryOptions({
    queryKey: [
      "storage",
      "s3",
      "test",
      input.endpoint,
      input.accessKeyId,
      input.secretKey,
      input.region,
    ] as const,
    queryFn: async () => {
      const res = await getGoClient().storage.s3.test({
        endpoint: input.endpoint,
        access_key_id: input.accessKeyId,
        secret_key: input.secretKey,
        region: input.region,
      });
      return { data: res.data };
    },
  });

// ---- Volumes (PVC) ----

type TVolumeRef = {
  id: string;
  type: PvcScope;
  teamId: string;
  projectId: string;
  environmentId: string;
};

export const volumeQuery = (input: TVolumeRef) =>
  queryOptions({
    queryKey: queryKeyStorage.volume(input),
    queryFn: async () => {
      const res = await getGoClient().storage.pvc.get({
        id: input.id,
        type: input.type,
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
      });
      return { volume: res.data };
    },
  });

export async function deleteVolume(input: TVolumeRef) {
  const res = await getGoClient().storage.pvc.delete({
    id: input.id,
    type: input.type,
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
  });
  return { data: res.data };
}

export async function expandVolume(input: TVolumeRef & { capacityGb: number }) {
  const res = await getGoClient().storage.pvc.update({
    id: input.id,
    type: input.type,
    capacity_gb: input.capacityGb,
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
  });
  return { volume: res.data };
}

// ---- Types ----

export type TS3SourceShallow = S3Response;

export const s3SourceNameMinLength = 2;
export const s3SourceNameMaxLength = 32;

export const S3SourceNameSchema = z
  .string()
  .min(s3SourceNameMinLength, `Name should be at least ${s3SourceNameMinLength} characters.`)
  .max(s3SourceNameMaxLength, `Name should be at most ${s3SourceNameMaxLength} characters.`);

export const CreateS3SourceFormSchema = z.object({
  name: S3SourceNameSchema,
  endpoint: z.string().url("Endpoint must be a valid URL."),
  accessKeyId: z.string().min(1, "Access Key ID is required."),
  secretKey: z.string().min(1, "Secret Access Key is required."),
  region: z.string(),
});

export type TVolumeType = z.infer<typeof PvcScopeSchema>;
