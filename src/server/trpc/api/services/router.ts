import { CreateServiceInput } from "@/server/go/client.gen";
import { CreateServiceSchema, UpdateServiceInputSchema } from "@/server/trpc/api/services/types";
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
  create: publicProcedure.input(CreateServiceSchema).mutation(async function ({ input, ctx }) {
    const { session, goClient } = ctx;
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You need to be logged in to access this resource",
      });
    }

    const sharedParams: CreateServiceInput = {
      team_id: input.teamId,
      project_id: input.projectId,
      environment_id: input.environmentId,
      display_name: input.displayName,
      description: input.description,
      public: input.public,
      builder: input.builder,
      type: input.type,
      replicas: 1,
    };

    let params: CreateServiceInput;

    if (input.type === "docker-image") {
      params = {
        ...sharedParams,
        builder: input.builder,
        image: input.image,
      };
    } else {
      params = {
        ...sharedParams,
        builder: input.builder,
        git_branch: input.gitBranch,
        github_installation_id: input.gitHubInstallationId,
        repository_name: input.repositoryName,
        repository_owner: input.repositoryOwner,
      };
    }

    const service = await goClient.services.create(params);
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
