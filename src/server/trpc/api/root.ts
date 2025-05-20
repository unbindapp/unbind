import { deploymentsRouter } from "@/server/trpc/api/deployments/router";
import { dockerRouter } from "@/server/trpc/api/docker/router";
import { environmentsRouter } from "@/server/trpc/api/environments/router";
import { gitRouter } from "@/server/trpc/api/git/router";
import { instancesRouter } from "@/server/trpc/api/instances/router";
import { logsRouter } from "@/server/trpc/api/logs/router";
import { metricsRouter } from "@/server/trpc/api/metrics/router";
import { projectsRouter } from "@/server/trpc/api/projects/router";
import { serviceGroupsRouter } from "@/server/trpc/api/service-group/router";
import { servicesRouter } from "@/server/trpc/api/services/router";
import { setupRouter } from "@/server/trpc/api/setup/router";
import { storageRouter } from "@/server/trpc/api/storage/router";
import { systemRouter } from "@/server/trpc/api/system/router";
import { teamsRouter } from "@/server/trpc/api/teams/router";
import { templatesRouter } from "@/server/trpc/api/templates/router";
import { variablesRouter } from "@/server/trpc/api/variables/router";
import { webhooksRouter } from "@/server/trpc/api/webhooks/router";
import { createTRPCRouter } from "@/server/trpc/setup/trpc";
import { TRPCClient, TRPCClientErrorLike } from "@trpc/client";
import { inferReactQueryProcedureOptions } from "@trpc/react-query";
import { UseTRPCQueryResult, UseTRPCSuspenseQueryResult } from "@trpc/react-query/shared";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  teams: teamsRouter,
  projects: projectsRouter,
  services: servicesRouter,
  serviceGroups: serviceGroupsRouter,
  templates: templatesRouter,
  instances: instancesRouter,
  deployments: deploymentsRouter,
  environments: environmentsRouter,
  variables: variablesRouter,
  logs: logsRouter,
  metrics: metricsRouter,
  git: gitRouter,
  docker: dockerRouter,
  webhooks: webhooksRouter,
  system: systemRouter,
  setup: setupRouter,
  storage: storageRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
export type AppRouterReactQueryOptions = inferReactQueryProcedureOptions<AppRouter>;
export type AppRouterQueryClient = TRPCClient<AppRouter>;
export type AppRouterInputs = inferRouterInputs<AppRouter>;
export type AppRouterOutputs = inferRouterOutputs<AppRouter>;

export type AppRouterQueryResult<Output> = UseTRPCQueryResult<
  Output,
  TRPCClientErrorLike<AppRouter>
>;

export type AppRouterSuspenseQueryResult<Output> = UseTRPCSuspenseQueryResult<
  Output,
  TRPCClientErrorLike<AppRouter>
>;
