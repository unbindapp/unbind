import type { ListDeploymentsResponseBody } from "@/server/go/client.gen";

export type TDeploymentShallow = NonNullable<
  ListDeploymentsResponseBody["data"]["deployments"]
>[number];
