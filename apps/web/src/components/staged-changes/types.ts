// Relative imports so this can run under `node --test`.
import { z } from "zod";
import { VariableReferenceSourceTypeSchema } from "../../lib/server/client.gen.ts";

export const VariableScopeSchema = z.object({
  type: VariableReferenceSourceTypeSchema,
  teamId: z.string(),
  projectId: z.string().optional(),
  environmentId: z.string().optional(),
  serviceId: z.string().optional(),
});

export type TVariableScope = z.infer<typeof VariableScopeSchema>;

export const StagedVariableChangeSchema = z.object({
  id: z.string(),
  scope: VariableScopeSchema,
  scopeName: z.string(),
  scopeIcon: z.string().optional(),
  name: z.string(),
  // null removes the variable
  value: z.string().nullable(),
  // null means the variable does not exist yet
  previous: z.string().nullable(),
  createdAt: z.number(),
});

export type TStagedVariableChange = z.infer<typeof StagedVariableChangeSchema>;

export const ServiceChangeFieldSchema = z.enum([
  "isPublic",
  "replicaCount",
  "cpuLimitMillicores",
  "memoryLimitMb",
  "builder",
  "railpackBuilderInstallCommand",
  "railpackBuilderBuildCommand",
  "dockerBuilderDockerfilePath",
  "dockerBuilderBuildContext",
  "startCommand",
  "gitRepository",
  "gitBranch",
  "autoDeploy",
  "watchPaths",
  "image",
  "s3BackupBucketId",
  "backupSchedule",
  "backupRetentionCount",
  "healthCheckType",
  "healthCheckEndpoint",
  "healthCheckEndpointPort",
  "healthCheckCommand",
  "healthCheckIntervalSeconds",
  "healthCheckFailureThreshold",
  "startupCheckIntervalSeconds",
  "startupCheckFailureThreshold",
  "walLevel",
  "maxReplicationSlots",
  "maxWalSenders",
  "maxSlotWalKeepSizeMb",
]);

export type TServiceChangeField = z.infer<typeof ServiceChangeFieldSchema>;

export const StagedServiceChangeSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  serviceIcon: z.string().optional(),
  field: ServiceChangeFieldSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: z.string(),
  displayValue: z.string(),
  displayPrevious: z.string(),
  createdAt: z.number(),
});

export type TStagedServiceChange = z.infer<typeof StagedServiceChangeSchema>;

const StagedListChangeBaseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  serviceIcon: z.string().optional(),
  createdAt: z.number(),
});

export const HostTargetSchema = z.object({
  host: z.string(),
  port: z.number().optional(),
});

export type THostTarget = z.infer<typeof HostTargetSchema>;

export const StagedHostChangeSchema = StagedListChangeBaseSchema.extend({
  kind: z.literal("host"),
  // null means the domain does not exist yet
  previous: HostTargetSchema.nullable(),
  // null removes the domain
  value: HostTargetSchema.nullable(),
  // The service does not have the port yet, so it is added along with the domain
  addsPort: z.boolean(),
});

export type TStagedHostChange = z.infer<typeof StagedHostChangeSchema>;

export const StagedPortChangeSchema = StagedListChangeBaseSchema.extend({
  kind: z.literal("port"),
  port: z.number(),
  op: z.enum(["add", "remove"]),
});

export type TStagedPortChange = z.infer<typeof StagedPortChangeSchema>;

export const StagedVolumeChangeSchema = StagedListChangeBaseSchema.extend({
  kind: z.literal("volume"),
  volumeId: z.string(),
  volumeName: z.string(),
  // null unmounts the volume from the service
  mountPath: z.string().nullable(),
  // Set when the volume is already on the service, so its path changes or it unmounts
  previousMountPath: z.string().optional(),
});

export type TStagedVolumeChange = z.infer<typeof StagedVolumeChangeSchema>;

// Changes to the lists a service holds: its domains, its ports and its volumes
export const StagedListChangeSchema = z.discriminatedUnion("kind", [
  StagedHostChangeSchema,
  StagedPortChangeSchema,
  StagedVolumeChangeSchema,
]);

export type TStagedListChange = z.infer<typeof StagedListChangeSchema>;

type TOmitFromEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type TStageListInput = TOmitFromEach<TStagedListChange, "id" | "createdAt">;

export const StagedChangesStateSchema = z.object({
  variables: z.record(z.string(), StagedVariableChangeSchema),
  services: z.record(z.string(), StagedServiceChangeSchema),
  lists: z.record(z.string(), StagedListChangeSchema),
});

export type TStagedChangesState = z.infer<typeof StagedChangesStateSchema>;

export type TStagedValue = TStagedVariableChange["value"] | TStagedServiceChange["value"];

// What a list change would leave behind, in a form that can be compared
export function listChangeValue(change: TStagedListChange): string | null {
  if (change.kind === "port") return change.op;
  if (change.kind === "volume") return `${change.serviceId}:${change.mountPath ?? "unmounted"}`;
  if (change.value === null) return null;
  return `${change.value.host}:${change.value.port ?? ""}`;
}

export function variableScopeKey(scope: TVariableScope) {
  return [
    scope.type,
    scope.teamId,
    scope.projectId ?? "",
    scope.environmentId ?? "",
    scope.serviceId ?? "",
  ].join(":");
}

export function variableChangeId(scope: TVariableScope, name: string) {
  return `variable:${variableScopeKey(scope)}:${name}`;
}

export function serviceChangeId(serviceId: string, field: TServiceChangeField) {
  return `service:${serviceId}:${field}`;
}

// A domain keeps the id of the host the server has, so an edit and a removal replace each other
export function hostChangeId(serviceId: string, host: string) {
  return `host:${serviceId}:${host}`;
}

export function portChangeId(serviceId: string, port: number) {
  return `port:${serviceId}:${port}`;
}

// A volume mounts on one service only, so staging it again replaces the earlier change
export function volumeChangeId(volumeId: string) {
  return `volume:${volumeId}`;
}

export function listChangeId(change: TStageListInput) {
  if (change.kind === "port") return portChangeId(change.serviceId, change.port);
  if (change.kind === "volume") return volumeChangeId(change.volumeId);
  const host = change.previous?.host ?? change.value?.host ?? "";
  return hostChangeId(change.serviceId, host);
}

export function countChanges(state: TStagedChangesState) {
  return (
    Object.keys(state.variables).length +
    Object.keys(state.services).length +
    Object.keys(state.lists).length
  );
}
