import { z } from "zod";

export const DeploymentPanelTabEnum = z.enum(["info", "build-logs"]);
export type TDeploymentPanelTabEnum = z.infer<typeof DeploymentPanelTabEnum>;
export const deploymentPanelDefaultTabId = "build-logs";

export const deploymentPanelTabKey = "deployment-tab";
export const deploymentPanelDeploymentIdKey = "deployment";
