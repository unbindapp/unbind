import { logSearchParamKeys } from "@/components/logs/constants";
import { z } from "zod";

export const DeploymentPanelTabEnum = z.enum(["build-logs", "deploy-logs"]);
export type TDeploymentPanelTabEnum = z.infer<typeof DeploymentPanelTabEnum>;
export const deploymentPanelDefaultTabId = DeploymentPanelTabEnum.options[0];

export const deploymentPanelTabKey = "deployment_tab";
export const deploymentPanelDeploymentIdKey = "deployment";

// Everything the panel writes to the URL for the deployment it is open for. Cleared
// when it closes and restored when the same deployment is opened again, so anything
// new the panel puts in the URL belongs here.
export const deploymentPanelOwnedSearchKeys = [
  deploymentPanelTabKey,
  ...Object.values(logSearchParamKeys.deployment),
  ...Object.values(logSearchParamKeys.build),
];
