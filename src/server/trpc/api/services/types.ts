import {
  DatabaseConfigSchema,
  HealthCheckTypeSchema,
  HostSpecSchema,
  PortSpecSchema,
  ServiceBuilderSchema,
} from "@/server/go/client.gen";
import { AvailableDatabaseEnum } from "@/server/go/data.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export const serviceNameMinLength = 2;
export const serviceNameMaxLength = 32;
export const serviceDescriptionMaxLength = 128;

export type TServiceShallow = AppRouterOutputs["services"]["list"]["services"][number];
export type TService = AppRouterOutputs["services"]["get"]["service"];
export type TVolumeShallow = TService["config"]["volumes"][number];

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
    ports: PortSpecSchema.array().optional(),
    overwriteHosts: HostSpecSchema.array().optional(),
    addHosts: HostSpecSchema.array().optional(),
    removeHosts: HostSpecSchema.array().optional(),
    databaseConfig: DatabaseConfigSchema.optional(),
    s3BackupSourceId: z.string().uuid().optional(),
    s3BackupBucket: z.string().optional(),
    builder: ServiceBuilderSchema.optional(),
    installCommand: z.string().optional(),
    buildCommand: z.string().optional(),
    startCommand: z.string().optional(),
  })
  .strip();

export type TUpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;

export type THostFromServiceList = NonNullable<
  AppRouterOutputs["services"]["list"]["services"][number]["config"]["hosts"]
>[0];

export type THostFromServiceGet = NonNullable<
  AppRouterOutputs["services"]["get"]["service"]["config"]["hosts"]
>[0];

export type TExternalEndpoint = NonNullable<
  AppRouterOutputs["services"]["getServiceEndpoints"]["endpoints"]["external"]
>[0];
