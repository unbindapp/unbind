import { z } from "zod";

export const ServerPanelTabEnum = z.enum(["details", "metrics"]);
export type TServerPanelTabEnum = z.infer<typeof ServerPanelTabEnum>;
export const serverPanelDefaultTabId = ServerPanelTabEnum.options[0];

export const serverPanelTabKey = "server_tab";
export const serverPanelServerNameKey = "server";
