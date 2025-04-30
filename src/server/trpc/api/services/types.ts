import { HostSpecSchema, PortSpecSchema } from "@/server/go/client.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export const serviceNameMinLength = 2;
export const serviceNameMaxLength = 32;
export const serviceDescriptionMaxLength = 128;

export type TServiceShallow = AppRouterOutputs["services"]["list"]["services"][number];
export type TService = AppRouterOutputs["services"]["get"]["service"];

export const ServicenameSchema = z
  .string()
  .min(serviceNameMinLength, `Name should be at least ${serviceNameMinLength} characters.`)
  .max(serviceNameMaxLength, `Name should be at most ${serviceNameMaxLength} characters.`);

export const ServiceDescriptionSchema = z
  .string()
  .max(
    serviceDescriptionMaxLength,
    `Description should be at most ${serviceDescriptionMaxLength} characters.`,
  );

export const CreateServiceSharedSchema = z
  .object({
    name: ServicenameSchema,
    description: ServiceDescriptionSchema.optional(),
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    environmentId: z.string().uuid(),
    isPublic: z.boolean(),
    ports: PortSpecSchema.array().optional(),
    hosts: HostSpecSchema.array().optional(),
  })
  .strip();

export const CreateServiceFromGitSchema = z
  .object({
    type: z.enum(["github"]),
    builder: z.enum(["railpack"]),
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

const AvailableDatabaseEnum = z.enum(["postgres", "redis"]);

export type TAvailableDatabase = z.infer<typeof AvailableDatabaseEnum>;

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
    name: ServicenameSchema.optional(),
    description: ServiceDescriptionSchema.optional(),
    gitBranch: z.string().optional(),
    image: z.string().optional(),
    isPublic: z.boolean().optional(),
    ports: PortSpecSchema.array().optional(),
    hosts: HostSpecSchema.array().optional(),
  })
  .strip();

export type TUpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;

export type THost = NonNullable<
  AppRouterOutputs["services"]["get"]["service"]["config"]["hosts"]
>[0];
