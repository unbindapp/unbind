import { z } from "zod";

export const DeploymentPanelTabEnum = z.enum(["build-logs", "deploy-logs"]);
export type TDeploymentPanelTabEnum = z.infer<typeof DeploymentPanelTabEnum>;
export const deploymentPanelDefaultTabId = DeploymentPanelTabEnum.options[0];

export const deploymentPanelTabKey = "deployment-tab";
export const deploymentPanelDeploymentIdKey = "deployment";
