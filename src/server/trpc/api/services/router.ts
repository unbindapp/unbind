import { CreateServiceFromGitSchema } from "@/server/trpc/api/services/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const servicesRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const services = await goClient.services.list({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
      });
      return {
        services: services.data || [],
      };
    }),
  get: publicProcedure
    .input(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
        serviceId: z.string(),
      }),
    )
    .query(async function ({ input: { teamId, projectId, environmentId, serviceId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const service = await goClient.services.get({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
      });
      return {
        service: service.data,
      };
    }),
  create: publicProcedure.input(CreateServiceFromGitSchema).mutation(async function ({
    input: {
      builder,
      type,
      displayName,
      description,
      teamId,
      projectId,
      environmentId,
      gitBranch,
      repositoryName,
      repositoryOwner,
      gitHubInstallationId,
    },
    ctx,
  }) {
    const { session, goClient } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You need to be logged in to access this resource",
      });
    }
    const service = await goClient.services.create({
      Builder: builder,
      Type: type,
      team_id: teamId,
      project_id: projectId,
      environment_id: environmentId,
      display_name: displayName,
      description: description,
      git_branch: gitBranch,
      repository_name: repositoryName,
      repository_owner: repositoryOwner,
      github_installation_id: gitHubInstallationId,
      replicas: 1,
      port: 3000,
    });
    return {
      service: service.data,
    };
  }),
});
