import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export type TServiceShallow = AppRouterOutputs["services"]["list"]["services"][number];
export type TService = AppRouterOutputs["services"]["get"]["service"];

export const CreateServiceSharedSchema = z.object({
  displayName: z.string(),
  description: z.string(),
  teamId: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  port: z.number().optional(),
  host: z.string().optional(),
  public: z.boolean(),
  gitHubInstallationId: z.number(),
});

export const CreateServiceFromGitSchema = z.object({
  builder: z.string(),
  type: z.enum(["git"]),
  gitBranch: z.string(),
  repositoryName: z.string(),
  repositoryOwner: z.string(),
  ...CreateServiceSharedSchema.shape,
});
