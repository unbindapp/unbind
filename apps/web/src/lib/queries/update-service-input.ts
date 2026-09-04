// Relative imports so this can run under `node --test`.
import { z } from "zod";
import {
  DatabaseConfigSchema,
  HealthCheckTypeSchema,
  HostSpecSchema,
  PortSpecSchema,
  ServiceBuilderSchema,
  ServiceVolumeSchema,
  type UpdateServiceInput,
} from "../server/client.gen.ts";

export const serviceNameMinLength = 2;
export const serviceNameMaxLength = 32;
export const serviceDescriptionMaxLength = 128;

export const ServiceNameSchema = z
  .string()
  .min(serviceNameMinLength, `Name should be at least ${serviceNameMinLength} characters.`)
  .max(serviceNameMaxLength, `Name should be at most ${serviceNameMaxLength} characters.`);

export const ServiceDescriptionSchema = z
  .string()
  .max(
    serviceDescriptionMaxLength,
    `Description should be at most ${serviceDescriptionMaxLength} characters.`,
  );

export const UpdateServiceInputSchema = z
  .object({
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    environmentId: z.string().uuid(),
    serviceId: z.string().uuid(),
    name: ServiceNameSchema.optional(),
    description: ServiceDescriptionSchema.optional(),
    gitBranch: z.string().optional(),
    image: z.string().optional(),
    isPublic: z.boolean().optional(),
    overwritePorts: PortSpecSchema.array().optional(),
    overwriteHosts: HostSpecSchema.array().optional(),
    upsertHosts: HostSpecSchema.array().optional(),
    removeHosts: HostSpecSchema.array().optional(),
    addPorts: PortSpecSchema.array().optional(),
    removePorts: PortSpecSchema.array().optional(),
    addVolumes: ServiceVolumeSchema.array().optional(),
    removeVolumes: ServiceVolumeSchema.array().optional(),
    databaseConfig: DatabaseConfigSchema.optional(),
    s3BackupBucketId: z.string().uuid().optional(),
    builder: ServiceBuilderSchema.optional(),
    railpackBuilderInstallCommand: z.string().optional(),
    railpackBuilderBuildCommand: z.string().optional(),
    dockerBuilderDockerfilePath: z.string().optional(),
    dockerBuilderBuildContext: z.string().optional(),
    startCommand: z.string().optional(),
    instanceCount: z.number().int().min(1).optional(),
    cpuLimitMillicores: z.number().int().optional(),
    memoryLimitMb: z.number().int().optional(),
    healthCheckType: HealthCheckTypeSchema.optional(),
    healthCheckEndpoint: z.string().optional(),
    healthCheckEndpointPort: z.number().int().optional(),
    healthCheckCommand: z.string().optional(),
    healthCheckIntervalSeconds: z.number().int().optional(),
    healthCheckFailureThreshold: z.number().int().optional(),
    startupCheckIntervalSeconds: z.number().int().optional(),
    startupCheckFailureThreshold: z.number().int().optional(),
  })
  .strip();

export type TUpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;

// Maps the flat camelCase form fields to the goClient's nested UpdateServiceInput
export function toUpdateServiceInput(input: TUpdateServiceInput): UpdateServiceInput {
  const {
    teamId,
    projectId,
    environmentId,
    serviceId,
    name,
    description,
    gitBranch,
    image,
    isPublic,
    overwritePorts,
    overwriteHosts,
    databaseConfig,
    s3BackupBucketId,
    builder,
    railpackBuilderBuildCommand,
    railpackBuilderInstallCommand,
    dockerBuilderDockerfilePath,
    dockerBuilderBuildContext,
    startCommand,
    instanceCount,
    cpuLimitMillicores,
    memoryLimitMb,
    healthCheckType,
    healthCheckEndpoint,
    healthCheckEndpointPort,
    healthCheckCommand,
    healthCheckIntervalSeconds,
    healthCheckFailureThreshold,
    startupCheckIntervalSeconds,
    startupCheckFailureThreshold,
    upsertHosts,
    removeHosts,
    addPorts,
    removePorts,
    addVolumes,
    removeVolumes,
  } = input;

  const resources: UpdateServiceInput["resources"] | undefined =
    cpuLimitMillicores !== undefined || memoryLimitMb !== undefined ? {} : undefined;
  if (cpuLimitMillicores !== undefined && resources) {
    resources.cpu_limits_millicores = cpuLimitMillicores;
  }
  if (memoryLimitMb !== undefined && resources) {
    resources.memory_limits_megabytes = memoryLimitMb;
  }

  const hasHealthCheck = [
    healthCheckType,
    healthCheckEndpoint,
    healthCheckEndpointPort,
    healthCheckCommand,
    healthCheckIntervalSeconds,
    healthCheckFailureThreshold,
    startupCheckIntervalSeconds,
    startupCheckFailureThreshold,
  ].some((value) => value !== undefined);
  const healthCheck: UpdateServiceInput["health_check"] | undefined = hasHealthCheck
    ? {}
    : undefined;
  if (healthCheckType !== undefined && healthCheck) healthCheck.type = healthCheckType;
  if (healthCheckEndpoint !== undefined && healthCheck) healthCheck.path = healthCheckEndpoint;
  if (healthCheckEndpointPort !== undefined && healthCheck)
    healthCheck.port = healthCheckEndpointPort;
  if (healthCheckCommand !== undefined && healthCheck) healthCheck.command = healthCheckCommand;
  if (healthCheckType !== "none") {
    if (healthCheckIntervalSeconds !== undefined && healthCheck)
      healthCheck.health_period_seconds = healthCheckIntervalSeconds;
    if (healthCheckFailureThreshold !== undefined && healthCheck)
      healthCheck.health_failure_threshold = healthCheckFailureThreshold;
    if (startupCheckIntervalSeconds !== undefined && healthCheck)
      healthCheck.startup_period_seconds = startupCheckIntervalSeconds;
    if (startupCheckFailureThreshold !== undefined && healthCheck)
      healthCheck.startup_failure_threshold = startupCheckFailureThreshold;
  }

  return {
    team_id: teamId,
    project_id: projectId,
    environment_id: environmentId,
    service_id: serviceId,
    name,
    description,
    git_branch: gitBranch,
    image,
    is_public: isPublic,
    overwrite_ports: overwritePorts,
    overwrite_hosts: overwriteHosts,
    database_config: databaseConfig,
    s3_backup_bucket_id: s3BackupBucketId,
    builder,
    railpack_builder_install_command: railpackBuilderInstallCommand,
    railpack_builder_build_command: railpackBuilderBuildCommand,
    docker_builder_dockerfile_path: dockerBuilderDockerfilePath,
    docker_builder_build_context: dockerBuilderBuildContext,
    run_command: startCommand,
    replicas: instanceCount,
    resources,
    health_check: healthCheck,
    upsert_hosts: upsertHosts,
    remove_hosts: removeHosts,
    add_ports: addPorts,
    remove_ports: removePorts,
    add_volumes: addVolumes,
    remove_volumes: removeVolumes,
  };
}
