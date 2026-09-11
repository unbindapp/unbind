import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import GeneralTabContent from "@/components/system/settings/general-tab-content";

export const Route = createFileRoute("/system/settings/")({
  component: SystemGeneralSettings,
});

function SystemGeneralSettings() {
  return (
    <>
      <SettingsTabTitle>General</SettingsTabTitle>
      <GeneralTabContent className="mt-3" />
    </>
  );
}
