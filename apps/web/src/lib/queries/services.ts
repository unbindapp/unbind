import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import {
  ServiceDescriptionSchema,
  ServiceNameSchema,
  toUpdateServiceInput,
  type TUpdateServiceInput,
} from "@/lib/queries/update-service-input";
import {
  HealthCheckTypeSchema,
  HostSpecSchema,
  PortSpecSchema,
  ServiceBuilderSchema,
} from "@/lib/server/client.gen";
import type {
  CreateServiceInput,
  EndpointDiscovery,
  ServiceResponse,
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

export async function updateService(input: TUpdateServiceInput) {
  const res = await getGoClient().services.update(toUpdateServiceInput(input));
  return { service: res.data };
}

export {
  serviceDescriptionMaxLength,
  ServiceDescriptionSchema,
  serviceNameMaxLength,
  serviceNameMinLength,
  ServiceNameSchema,
  toUpdateServiceInput,
  UpdateServiceInputSchema,
  type TUpdateServiceInput,
} from "@/lib/queries/update-service-input";

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

export type THostFromServiceList = NonNullable<ServiceResponse["config"]["hosts"]>[0];

export type THostFromServiceGet = NonNullable<ServiceResponse["config"]["hosts"]>[0];

export type TExternalEndpoint = NonNullable<EndpointDiscovery["external"]>[0];

export type TInternalEndpoint = NonNullable<EndpointDiscovery["internal"]>[0];
