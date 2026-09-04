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
  name: z.string(),
  // null removes the variable
  value: z.string().nullable(),
  // null means the variable does not exist yet
  previous: z.string().nullable(),
  createdAt: z.number(),
});

export type TStagedVariableChange = z.infer<typeof StagedVariableChangeSchema>;

export const ServiceChangeFieldSchema = z.enum([
  "instanceCount",
  "cpuLimitMillicores",
  "memoryLimitMb",
  "builder",
  "railpackBuilderInstallCommand",
  "railpackBuilderBuildCommand",
  "dockerBuilderDockerfilePath",
  "dockerBuilderBuildContext",
  "startCommand",
  "gitBranch",
  "image",
  "s3BackupBucketId",
  "healthCheckType",
  "healthCheckEndpoint",
  "healthCheckEndpointPort",
  "healthCheckCommand",
  "healthCheckIntervalSeconds",
  "healthCheckFailureThreshold",
  "startupCheckIntervalSeconds",
  "startupCheckFailureThreshold",
]);

export type TServiceChangeField = z.infer<typeof ServiceChangeFieldSchema>;

export const StagedServiceChangeSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  field: ServiceChangeFieldSchema,
  value: z.union([z.string(), z.number()]),
  label: z.string(),
  displayValue: z.string(),
  displayPrevious: z.string(),
  createdAt: z.number(),
});

export type TStagedServiceChange = z.infer<typeof StagedServiceChangeSchema>;

export const ChangesStateSchema = z.object({
  variables: z.record(z.string(), StagedVariableChangeSchema),
  services: z.record(z.string(), StagedServiceChangeSchema),
});

export type TChangesState = z.infer<typeof ChangesStateSchema>;

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

export function countChanges(state: TChangesState) {
  return Object.keys(state.variables).length + Object.keys(state.services).length;
}
