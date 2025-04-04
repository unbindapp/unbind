import {
  CreateServiceFromGitSchema,
  UpdateServiceInputSchema,
} from "@/server/trpc/api/services/types";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/setup/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const servicesRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
        })
        .strip(),
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
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
          serviceId: z.string().uuid(),
        })
        .strip(),
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
      public: isPublic,
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
      builder,
      type,
      team_id: teamId,
      project_id: projectId,
      environment_id: environmentId,
      display_name: displayName,
      description: description,
      git_branch: gitBranch,
      repository_name: repositoryName,
      repository_owner: repositoryOwner,
      github_installation_id: gitHubInstallationId,
      public: isPublic,
      replicas: 1,
      auto_deploy: true,
    });
    return {
      service: service.data,
    };
  }),
  update: publicProcedure.input(UpdateServiceInputSchema).mutation(async function ({
    input: { teamId, projectId, environmentId, serviceId, displayName, description },
    ctx,
  }) {
    const { session, goClient } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You need to be logged in to access this resource",
      });
    }
    const service = await goClient.services.update({
      team_id: teamId,
      project_id: projectId,
      environment_id: environmentId,
      service_id: serviceId,
      display_name: displayName,
      description,
    });
    return {
      service: service.data,
    };
  }),
  delete: publicProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        projectId: z.string().uuid(),
        environmentId: z.string().uuid(),
        serviceId: z.string().uuid(),
      }),
    )
    .mutation(async function ({ input: { teamId, projectId, environmentId, serviceId }, ctx }) {
      const { session, goClient } = ctx;
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You need to be logged in to access this resource",
        });
      }
      const service = await goClient.services.delete({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
      });
      return {
        service: service.data,
      };
    }),
});
