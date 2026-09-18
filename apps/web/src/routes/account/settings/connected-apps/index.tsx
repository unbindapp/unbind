import { createFileRoute } from "@tanstack/react-router";

import ConnectedAppsList from "@/components/connected-apps/connected-apps-list";
import ConnectedAppsProvider from "@/components/connected-apps/connected-apps-provider";
import McpServerUrl from "@/components/connected-apps/mcp-server-url";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import { connectedAppsListQuery } from "@/lib/queries/connected-apps";

export const Route = createFileRoute("/account/settings/connected-apps/")({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(connectedAppsListQuery());
  },
  component: AccountConnectedAppsSettings,
});

function AccountConnectedAppsSettings() {
  return (
    <ConnectedAppsProvider>
      <SettingsTabTitle>Connected Apps</SettingsTabTitle>
      <p className="text-muted-foreground mt-1.5 w-full px-1">
        Applications you have granted access to your account, such as MCP clients.
      </p>
      <McpServerUrl className="mt-4" />
      <ConnectedAppsList className="mt-3" />
    </ConnectedAppsProvider>
  );
}
