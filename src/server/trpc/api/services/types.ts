import { ServiceBuilderSchema, ServiceTypeSchema } from "@/server/go/client.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export const serviceNameMinLength = 2;
export const serviceNameMaxLength = 32;
export const serviceDescriptionMaxLength = 128;

export type TServiceShallow = AppRouterOutputs["services"]["list"]["services"][number];
export type TService = AppRouterOutputs["services"]["get"]["service"];

export const ServiceDisplayNameSchema = z
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
    displayName: ServiceDisplayNameSchema,
    description: ServiceDescriptionSchema.optional(),
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    environmentId: z.string().uuid(),
    port: z.number().optional(),
    host: z.string().optional(),
    public: z.boolean(),
    gitHubInstallationId: z.number(),
  })
  .strip();

export const CreateServiceFromGitSchema = z
  .object({
    builder: ServiceBuilderSchema,
    type: ServiceTypeSchema,
    gitBranch: z.string(),
    repositoryName: z.string(),
    repositoryOwner: z.string(),
  })
  .merge(CreateServiceSharedSchema)
  .strip();

export const UpdateServiceInputSchema = z
  .object({
    teamId: z.string().uuid(),
    projectId: z.string().uuid(),
    environmentId: z.string().uuid(),
    serviceId: z.string().uuid(),
    displayName: ServiceDisplayNameSchema.optional(),
    description: ServiceDescriptionSchema.optional(),
  })
  .strip();

export type THost = NonNullable<
  AppRouterOutputs["services"]["get"]["service"]["config"]["hosts"]
>[0];
