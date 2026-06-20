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
export const servicePanelServiceIdKey = "service";
