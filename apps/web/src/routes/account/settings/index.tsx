import { createFileRoute } from "@tanstack/react-router";

import GeneralTabContent from "@/components/account/settings/general-tab-content";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export const Route = createFileRoute("/account/settings/")({
  component: AccountGeneralSettings,
});

function AccountGeneralSettings() {
  return (
    <>
      <SettingsTabTitle>General</SettingsTabTitle>
      <GeneralTabContent className="mt-3" />
    </>
  );
}
