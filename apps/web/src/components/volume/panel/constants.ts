import { z } from "zod";

export const VolumePanelTabEnum = z.enum(["details"]);
export type TVolumePanelTabEnum = z.infer<typeof VolumePanelTabEnum>;
export const volumePanelDefaultTabId = VolumePanelTabEnum.options[0];

export const volumePanelTabKey = "volume_tab";
export const volumePanelVolumeIdKey = "volume";

// Everything the panel writes to the URL for the volume it is open for. Cleared when
// it closes and restored when the same volume is opened again.
export const volumePanelOwnedSearchKeys = [volumePanelTabKey];
