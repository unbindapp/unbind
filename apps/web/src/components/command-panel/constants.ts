import { TContextCommandPanelContext } from "@/components/command-panel/types";
import { z } from "zod";

export const commandPanelKey = "command_panel";
export const commandPanelPageKey = "command_panel_page";

export const contextCommandPanelId = "context";
export const contextCommandPanelRootPage = "root";

export const TriggerTypeEnum = z.enum(["layout", "button", "list"]);
export type TTriggerType = z.infer<typeof TriggerTypeEnum>;

export function getContextCommandPanelId(
  contextType: TContextCommandPanelContext["contextType"],
  triggerType: TTriggerType,
) {
  return `${contextCommandPanelId}_${contextType}_${triggerType}`;
}
