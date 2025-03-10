import { githubRouter } from "@/server/trpc/api/github/router";
import { mainRouter } from "@/server/trpc/api/main/router";
import { createTRPCRouter } from "@/server/trpc/setup/trpc";
import { inferRouterClient, TRPCClientErrorLike } from "@trpc/client";
import { inferReactQueryProcedureOptions } from "@trpc/react-query";
import { UseTRPCQueryResult } from "@trpc/react-query/shared";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  main: mainRouter,
  github: githubRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
export type AppRouterReactQueryOptions = inferReactQueryProcedureOptions<AppRouter>;
export type AppRouterQueryClient = inferRouterClient<AppRouter>;
export type AppRouterInputs = inferRouterInputs<AppRouter>;
export type AppRouterOutputs = inferRouterOutputs<AppRouter>;

export type AppRouterQueryResult<Output> = UseTRPCQueryResult<
  Output,
  TRPCClientErrorLike<AppRouter>
>;
