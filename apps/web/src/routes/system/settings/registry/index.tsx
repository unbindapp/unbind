import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import RegistryTabContent from "@/components/system/settings/registry-tab-content";

export const Route = createFileRoute("/system/settings/registry/")({
  component: SystemRegistrySettings,
});

function SystemRegistrySettings() {
  return (
    <>
      <SettingsTabTitle>Registry</SettingsTabTitle>
      <RegistryTabContent className="mt-3" />
    </>
  );
}
