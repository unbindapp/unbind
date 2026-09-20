import {
  deploymentPanelDeploymentIdKey,
  deploymentPanelOwnedSearchKeys,
} from "@/components/deployment/panel/constants";
import { logSearchParamKeys } from "@/components/logs/constants";
import { metricsSearchParamKeys } from "@/components/metrics/constants";
import { providedVariablesKey, rawVariableEditorKey } from "@/components/variables/constants";
import { z } from "zod";

export const ServicePanelTabEnum = z.enum([
  "deployments",
  "variables",
  "logs",
  "metrics",
  "terminal",
  "settings",
]);
export type TServicePanelTabEnum = z.infer<typeof ServicePanelTabEnum>;
export const servicePanelDefaultTabId = ServicePanelTabEnum.options[0];

export const servicePanelTabKey = "service_tab";
// Open state of a database's Connect card, collapsed by default
export const servicePanelConnectKey = "connect";
export const servicePanelServiceIdKey = "service";

// Everything the panel writes to the URL for the service it is open for, including the
// deployment panel nested inside it. Cleared when it closes and restored when the same
// service is opened again, so anything new the panel puts in the URL belongs here.
export const servicePanelOwnedSearchKeys = [
  servicePanelTabKey,
  servicePanelConnectKey,
  providedVariablesKey,
  rawVariableEditorKey,
  metricsSearchParamKeys.service.interval,
  ...Object.values(logSearchParamKeys.service),
  deploymentPanelDeploymentIdKey,
  ...deploymentPanelOwnedSearchKeys,
];
