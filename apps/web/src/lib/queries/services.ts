import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import {
  DatabaseConfigSchema,
  HealthCheckTypeSchema,
  HostSpecSchema,
  PortSpecSchema,
  ServiceBuilderSchema,
} from "@/lib/server/client.gen";
import type {
  CreateServiceInput,
  EndpointDiscovery,
  ServiceResponse,
  UpdateServiceInput,
} from "@/lib/server/client.gen";
import { AvailableDatabaseEnum } from "@/lib/server/client.gen";

export const queryKeyServices = {
  list: (input: { teamId: string; projectId: string; environmentId: string }) =>
    ["services", "list", input.teamId, input.projectId, input.environmentId] as const,
  detail: (input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    serviceId: string;
  }) =>
    [
      "services",
      "detail",
      input.teamId,
      input.projectId,
      input.environmentId,
      input.serviceId,
    ] as const,
  endpoints: (input: {
    teamId: string;
    projectId: string;
    environmentId: string;
    serviceId: string;
  }) =>
    [
      "services",
      "endpoints",
      input.teamId,
      input.projectId,
      input.environmentId,
      input.serviceId,
    ] as const,
  databases: () => ["services", "databases"] as const,
  database: (input: { type: string; version?: string }) =>
    ["services", "database", input.type, input.version ?? null] as const,
};

export const servicesListQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) =>
  queryOptions({
    queryKey: queryKeyServices.list(input),
    queryFn: async () => {
      const res = await getGoClient().services.list({
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
      });
      return { services: res.data };
    },
  });

export const serviceQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeyServices.detail(input),
    queryFn: async () => {
      const res = await getGoClient().services.get({
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
      });
      return { service: res.data };
    },
  });

export const serviceEndpointsQuery = (input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) =>
  queryOptions({
    queryKey: queryKeyServices.endpoints(input),
    queryFn: async () => {
      const res = await getGoClient().services.endpoints.list({
        team_id: input.teamId,
        project_id: input.projectId,
        environment_id: input.environmentId,
        service_id: input.serviceId,
      });
      return { endpoints: res.data };
    },
  });

export const databasesListQuery = () =>
  queryOptions({
    queryKey: queryKeyServices.databases(),
    queryFn: async () => {
      const res = await getGoClient().services.databases.installable.list();
      return { databases: res.data };
    },
  });

export const databaseQuery = (input: { type: string; version?: string }) =>
  queryOptions({
    queryKey: queryKeyServices.database(input),
    queryFn: async () => {
      const res = await getGoClient().services.databases.installable.get({
        type: input.type,
        version: input.version,
      });
      return { database: res.data };
    },
  });

// Mutations take the goClient's native input types directly — the flat form-field
// → nested input mapping (resources, health_check, etc.) belongs to the form.
export async function createService(input: CreateServiceInput) {
  const res = await getGoClient().services.create(input);
  return { service: res.data };
}

// Maps the flat camelCase form fields to the goClient's nested UpdateServiceInput
// (resources / health_check) — this is the logic the old tRPC router did.
export async function updateService(input: TUpdateServiceInput) {
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
    s3BackupSourceId,
    s3BackupBucket,
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
  } = input;

  const resources: UpdateServiceInput["resources"] | undefined =
    cpuLimitMillicores !== undefined || memoryLimitMb !== undefined ? {} : undefined;
  if (cpuLimitMillicores !== undefined && resources) {
    resources.cpu_limits_millicores = cpuLimitMillicores;
  }
  if (memoryLimitMb !== undefined && resources) {
    resources.memory_limits_megabytes = memoryLimitMb;
  }

  const healthCheck: UpdateServiceInput["health_check"] | undefined =
    healthCheckType || healthCheckEndpoint || healthCheckCommand ? {} : undefined;
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

  const res = await getGoClient().services.update({
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
    s3_backup_source_id: s3BackupSourceId,
    s3_backup_bucket: s3BackupBucket,
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
  });
  return { service: res.data };
}

export async function deleteService(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
}) {
  const res = await getGoClient().services.delete({
    team_id: input.teamId,
    project_id: input.projectId,
    environment_id: input.environmentId,
    service_id: input.serviceId,
  });
  return { service: res.data };
}

// ---- Types ----

export type TServiceShallow = ServiceResponse;
export type TService = ServiceResponse;
export type TServiceEndpoints = EndpointDiscovery;
export type TVolumeShallow = TService["config"]["volumes"][number];

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

export const ServiceRenameSchema = z.object({
  name: ServiceNameSchema,
  description: ServiceDescriptionSchema,
});

export const CreateServiceSharedSchema = z
  .object({
    name: ServiceNameSchema,
    description: ServiceDescriptionSchema.optional(),
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    environmentId: z.string().uuid(),
    isPublic: z.boolean(),
    ports: PortSpecSchema.array().optional(),
    overwriteHosts: HostSpecSchema.array().optional(),
    autoDeploy: z.boolean(),
  })
  .strip();

export const GitServiceBuilderEnum = ServiceBuilderSchema.exclude(["database"]);
export type TGitServiceBuilder = z.infer<typeof GitServiceBuilderEnum>;
export type TBuilderEnum = z.infer<typeof ServiceBuilderSchema>;

export type THealthCheckType = z.infer<typeof HealthCheckTypeSchema>;

export const CreateServiceFromGitSchema = z
  .object({
    type: z.enum(["github"]),
    builder: GitServiceBuilderEnum,
    gitHubInstallationId: z.number(),
    repositoryName: z.string(),
    repositoryOwner: z.string(),
  })
  .merge(CreateServiceSharedSchema)
  .strip();

export const CreateServiceFromDockerImageSchema = z
  .object({
    type: z.enum(["docker-image"]),
    builder: z.enum(["docker"]),
    image: z.string(),
  })
  .merge(CreateServiceSharedSchema)
  .strip();

export const CreateServiceFromDatabaseSchema = z
  .object({
    type: z.enum(["database"]),
    builder: z.enum(["database"]),
    database_type: AvailableDatabaseEnum,
  })
  .merge(CreateServiceSharedSchema)
  .strip();

export const CreateServiceSchema = z.discriminatedUnion("type", [
  CreateServiceFromGitSchema,
  CreateServiceFromDockerImageSchema,
  CreateServiceFromDatabaseSchema,
]);

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
    databaseConfig: DatabaseConfigSchema.optional(),
    s3BackupSourceId: z.string().uuid().optional(),
    s3BackupBucket: z.string().optional(),
    builder: ServiceBuilderSchema.optional(),
    installCommand: z.string().optional(),
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

export type THostFromServiceList = NonNullable<ServiceResponse["config"]["hosts"]>[0];

export type THostFromServiceGet = NonNullable<ServiceResponse["config"]["hosts"]>[0];

export type TExternalEndpoint = NonNullable<EndpointDiscovery["external"]>[0];

export type TInternalEndpoint = NonNullable<EndpointDiscovery["internal"]>[0];
