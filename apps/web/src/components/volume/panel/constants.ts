import { z } from "zod";

export const VolumePanelTabEnum = z.enum(["settings"]);
export type TVolumePanelTabEnum = z.infer<typeof VolumePanelTabEnum>;
export const volumePanelDefaultTabId = VolumePanelTabEnum.options[0];

export const volumePanelTabKey = "volume_tab";
export const volumePanelVolumeIdKey = "volume";
