import type { ListDeploymentsResponseBody } from "@/server/client.gen";

export type TDeploymentShallow = NonNullable<
  ListDeploymentsResponseBody["data"]["deployments"]
>[number];
