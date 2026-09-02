import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import { PvcScopeSchema } from "@/lib/server/client.gen";
import type { PvcScope, S3BucketResponse } from "@/lib/server/client.gen";

export const queryKeyStorage = {
  s3List: (input: { teamId: string }) => ["storage", "s3", "list", input.teamId] as const,
  s3Detail: (input: { teamId: string; id: string }) =>
    ["storage", "s3", "detail", input.teamId, input.id] as const,
  volumeList: (input: { teamId: string; projectId: string; environmentId: string }) =>
    ["storage", "volume", "list", input.teamId, input.projectId, input.environmentId] as const,
};

// ---- S3 buckets ----

export const s3BucketsListQuery = (input: { teamId: string }) =>
  queryOptions({
    queryKey: queryKeyStorage.s3List(input),
    queryFn: async () => {
      const res = await getGoClient().storage.s3.list({ team_id: input.teamId });
      return { buckets: res.data };
    },
  });

export const s3BucketQuery = (input: { id: string; teamId: string }) =>
  queryOptions({
    queryKey: queryKeyStorage.s3Detail(input),
    queryFn: async () => {
      const res = await getGoClient().storage.s3.get({ id: input.id, team_id: input.teamId });
      return { bucket: res.data };
    },
  });

type TS3Connection = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretKey: string;
};

export async function createS3Bucket(input: TS3Connection & { teamId: string; name: string }) {
  const res = await getGoClient().storage.s3.create({
    team_id: input.teamId,
    name: input.name,
    endpoint: input.endpoint,
    region: input.region,
    bucket: input.bucket,
    access_key_id: input.accessKeyId,
    secret_key: input.secretKey,
  });
  return { data: res.data };
}

export type TUpdateS3BucketInput = Partial<TS3Connection> & {
  id: string;
  teamId: string;
  name?: string;
};

export async function updateS3Bucket(input: TUpdateS3BucketInput) {
  const res = await getGoClient().storage.s3.update({
    id: input.id,
    team_id: input.teamId,
    name: input.name,
    endpoint: input.endpoint,
    region: input.region,
    bucket: input.bucket,
    access_key_id: input.accessKeyId,
    secret_key: input.secretKey,
  });
  return { data: res.data };
}

export async function deleteS3Bucket(input: { id: string; teamId: string }) {
  const res = await getGoClient().storage.s3.delete({ id: input.id, team_id: input.teamId });
  return { data: res.data };
}

export const testS3Query = (input: TS3Connection) =>
  queryOptions({
    queryKey: [
      "storage",
      "s3",
      "test",
      input.endpoint,
      input.region,
      input.bucket,
      input.accessKeyId,
      input.secretKey,
    ] as const,
    queryFn: async () => {
      const res = await getGoClient().storage.s3.test({
        endpoint: input.endpoint,
        region: input.region,
        bucket: input.bucket,
        access_key_id: input.accessKeyId,
        secret_key: input.secretKey,
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

// Lists every PVC in the environment, including ones not mounted on any
// service (dangling) — the services list only surfaces mounted volumes.
export const volumesListQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) =>
  queryOptions({
    queryKey: queryKeyStorage.volumeList(input),
    queryFn: async () => {
      const res = await getGoClient().storage.pvc.list({
        type: "environment",
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
      });
      return { volumes: res.data };
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

export async function renameVolume(input: TVolumeRef & { name: string; description: string }) {
  const res = await getGoClient().storage.pvc.update({
    id: input.id,
    type: input.type,
    name: input.name,
    description: input.description,
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
  });
  return { volume: res.data };
}

// ---- Types ----

export type TS3BucketShallow = S3BucketResponse;

export const s3BucketNameMinLength = 2;
export const s3BucketNameMaxLength = 32;

export const S3BucketNameSchema = z
  .string()
  .min(s3BucketNameMinLength, `Name should be at least ${s3BucketNameMinLength} characters.`)
  .max(s3BucketNameMaxLength, `Name should be at most ${s3BucketNameMaxLength} characters.`);

export const CreateS3BucketFormSchema = z.object({
  name: S3BucketNameSchema,
  endpoint: z.string().url("Endpoint must be a valid URL."),
  region: z.string(),
  bucket: z.string().min(1, "Bucket name is required."),
  accessKeyId: z.string().min(1, "Access Key ID is required."),
  secretKey: z.string().min(1, "Secret Access Key is required."),
});

// Credentials are optional on edit, empty means keep the current ones
export const EditS3BucketFormSchema = z.object({
  name: S3BucketNameSchema,
  endpoint: z.string().url("Endpoint must be a valid URL."),
  region: z.string(),
  bucket: z.string().min(1, "Bucket name is required."),
  accessKeyId: z.string(),
  secretKey: z.string(),
});

export type TS3BucketFormValues = z.infer<typeof CreateS3BucketFormSchema>;

export type TVolumeType = z.infer<typeof PvcScopeSchema>;

export const volumeNameMinLength = 2;
export const volumeNameMaxLength = 32;
export const volumeDescriptionMaxLength = 128;

export const VolumeRenameSchema = z.object({
  name: z
    .string()
    .min(volumeNameMinLength, `Name should be at least ${volumeNameMinLength} characters.`)
    .max(volumeNameMaxLength, `Name should be at most ${volumeNameMaxLength} characters.`),
  description: z
    .string()
    .max(
      volumeDescriptionMaxLength,
      `Description should be at most ${volumeDescriptionMaxLength} characters.`,
    ),
});
