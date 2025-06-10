import { CreateServiceInput, UpdateServiceInput } from "@/server/go/client.gen";
import { CreateServiceSchema, UpdateServiceInputSchema } from "@/server/trpc/api/services/types";
import { createTRPCRouter, privateProcedure } from "@/server/trpc/setup/trpc";
import { z } from "zod";

export const servicesRouter = createTRPCRouter({
  list: privateProcedure
    .input(
      z
        .object({
          teamId: z.string().uuid(),
          projectId: z.string().uuid(),
          environmentId: z.string().uuid(),
        })
        .strip(),
    )
    .query(async function ({ input: { teamId, projectId, environmentId }, ctx: { goClient } }) {
      const services = await goClient.services.list({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
      });

      return {
        services: services.data,
      };
    }),
  get: privateProcedure
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
    .query(async function ({
      input: { teamId, projectId, environmentId, serviceId },
      ctx: { goClient },
    }) {
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
  getServiceEndpoints: privateProcedure
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
    .query(async function ({
      input: { teamId, projectId, environmentId, serviceId },
      ctx: { goClient },
    }) {
      const endpoints = await goClient.services.endpoints.list({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
      });
      return {
        endpoints: endpoints.data,
      };
    }),
  create: privateProcedure.input(CreateServiceSchema).mutation(async function ({
    input,
    ctx: { goClient },
  }) {
    const sharedParams: CreateServiceInput = {
      team_id: input.teamId,
      project_id: input.projectId,
      environment_id: input.environmentId,
      name: input.name,
      description: input.description,
      is_public: input.isPublic,
      builder: input.builder,
      type: input.type,
      replicas: 1,
      auto_deploy: input.autoDeploy,
    };

    let params: CreateServiceInput;

    if (input.type === "docker-image") {
      params = {
        ...sharedParams,
        builder: input.builder,
        image: input.image,
      };
    } else if (input.type === "database") {
      params = {
        ...sharedParams,
        builder: input.builder,
        database_type: input.database_type,
      };
    } else {
      params = {
        ...sharedParams,
        builder: input.builder,
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
  update: privateProcedure.input(UpdateServiceInputSchema).mutation(async function ({
    input: {
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
      railpackBuilderStartCommand,
      dockerBuilderDockerfilePath,
      dockerBuilderBuildContext,
      startCommand,
      instanceCount,
      cpuLimitMillicores,
      memoryLimitMb,
      healthCheckType,
      healthCheckEndpoint,
      healthCheckCommand,
    },
    ctx: { goClient },
  }) {
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
    if (healthCheckType !== undefined && healthCheck) {
      healthCheck.type = healthCheckType;
    }
    if (healthCheckEndpoint !== undefined && healthCheck) {
      healthCheck.path = healthCheckEndpoint;
    }
    if (healthCheckCommand !== undefined && healthCheck) {
      healthCheck.command = healthCheckCommand;
    }

    const service = await goClient.services.update({
      team_id: teamId,
      project_id: projectId,
      environment_id: environmentId,
      service_id: serviceId,
      name: name,
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
      railpack_builder_build_command: railpackBuilderStartCommand,
      railpack_builder_install_command: railpackBuilderBuildCommand,
      docker_builder_dockerfile_path: dockerBuilderDockerfilePath,
      docker_builder_build_context: dockerBuilderBuildContext,
      run_command: startCommand,
      replicas: instanceCount,
      resources,
      health_check: healthCheck,
    });
    return {
      service: service.data,
    };
  }),
  delete: privateProcedure
    .input(
      z.object({
        teamId: z.string().uuid(),
        projectId: z.string().uuid(),
        environmentId: z.string().uuid(),
        serviceId: z.string().uuid(),
      }),
    )
    .mutation(async function ({
      input: { teamId, projectId, environmentId, serviceId },
      ctx: { goClient },
    }) {
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
  listDatabases: privateProcedure.query(async function ({ ctx: { goClient } }) {
    const result = await goClient.services.databases.installable.list();
    return {
      databases: result.data,
    };
  }),
  getDatabase: privateProcedure
    .input(z.object({ type: z.string(), version: z.string().optional() }))
    .query(async function ({ input: { type, version }, ctx: { goClient } }) {
      const result = await goClient.services.databases.installable.get({
        type,
        version,
      });
      return {
        database: result.data,
      };
    }),
});
