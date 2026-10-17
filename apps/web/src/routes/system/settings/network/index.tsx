import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import NetworkTabContent from "@/components/system/settings/network-tab-content";
import { networkServicesQuery, networkSettingsQuery } from "@/lib/queries/network";

export const Route = createFileRoute("/system/settings/network/")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(networkSettingsQuery());
    void context.queryClient.prefetchQuery(networkServicesQuery());
  },
  component: SystemNetworkSettings,
});

function SystemNetworkSettings() {
  return (
    <>
      <SettingsTabTitle>Network</SettingsTabTitle>
      <NetworkTabContent className="mt-3" />
    </>
  );
}
