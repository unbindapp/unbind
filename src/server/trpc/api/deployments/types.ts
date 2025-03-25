import { AppRouterOutputs } from "@/server/trpc/api/root";

export type TDeploymentShallow = NonNullable<
  AppRouterOutputs["deployments"]["list"]["deployments"]
>[number];
