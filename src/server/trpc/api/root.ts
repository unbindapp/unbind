import { deploymentsRouter } from "@/server/trpc/api/deployments/router";
import { dockerRouter } from "@/server/trpc/api/docker/router";
import { environmentsRouter } from "@/server/trpc/api/environments/router";
import { gitRouter } from "@/server/trpc/api/git/router";
import { githubRouter } from "@/server/trpc/api/github/router";
import { logsRouter } from "@/server/trpc/api/logs/router";
import { mainRouter } from "@/server/trpc/api/main/router";
import { metricsRouter } from "@/server/trpc/api/metrics/router";
import { projectsRouter } from "@/server/trpc/api/projects/router";
import { servicesRouter } from "@/server/trpc/api/services/router";
import { teamsRouter } from "@/server/trpc/api/teams/router";
import { variablesRouter } from "@/server/trpc/api/variables/router";
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
  main: mainRouter,
  teams: teamsRouter,
  projects: projectsRouter,
  services: servicesRouter,
  deployments: deploymentsRouter,
  environments: environmentsRouter,
  variables: variablesRouter,
  logs: logsRouter,
  metrics: metricsRouter,
  github: githubRouter,
  git: gitRouter,
  docker: dockerRouter,
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
