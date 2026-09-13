import { metricsSearchParamKeys } from "@/components/metrics/constants";
import { z } from "zod";

export const ServerPanelTabEnum = z.enum(["details", "metrics"]);
export type TServerPanelTabEnum = z.infer<typeof ServerPanelTabEnum>;
export const serverPanelDefaultTabId = ServerPanelTabEnum.options[0];

export const serverPanelTabKey = "server_tab";
export const serverPanelServerNameKey = "server";

// Everything the panel writes to the URL for the server it is open for. Cleared when
// it closes and restored when the same server is opened again.
export const serverPanelOwnedSearchKeys = [
  serverPanelTabKey,
  metricsSearchParamKeys.server.interval,
];
