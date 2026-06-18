import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/server/client";
import { queryKeys } from "@/lib/queries/query-keys";
import type { PvcScope, S3Response } from "@/server/client.gen";

export type TS3SourceShallow = S3Response;

// ---- S3 sources ----

export const s3SourcesListQuery = (input: { teamId: string; withBuckets?: boolean }) =>
  queryOptions({
    queryKey: queryKeys.storage.s3List(input),
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
    queryKey: queryKeys.storage.s3Detail(input),
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
    queryKey: queryKeys.storage.volume(input),
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
