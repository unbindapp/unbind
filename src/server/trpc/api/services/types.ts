import { ServiceBuilderSchema, ServiceTypeSchema } from "@/server/go/client.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export type TServiceShallow = AppRouterOutputs["services"]["list"]["services"][number];
export type TService = AppRouterOutputs["services"]["get"]["service"];

export const CreateServiceSharedSchema = z
  .object({
    displayName: z.string(),
    description: z.string(),
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
    ...CreateServiceSharedSchema.shape,
  })
  .strip();
