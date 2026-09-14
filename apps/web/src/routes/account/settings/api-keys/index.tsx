import { createFileRoute } from "@tanstack/react-router";

import AddApiKeyForm from "@/components/api-key/add-api-key-form";
import ApiKeysList from "@/components/api-key/api-keys-list";
import ApiKeysProvider from "@/components/api-key/api-keys-provider";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import { apiKeysListQuery } from "@/lib/queries/api-keys";
import { teamsListQuery } from "@/lib/queries/teams";

export const Route = createFileRoute("/account/settings/api-keys/")({
  // Runs on intent preload (hover) so hovering the tab warms the cache
  // before navigation. Non-blocking; the provider shows skeletons meanwhile.
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(apiKeysListQuery());
    void queryClient.prefetchQuery(teamsListQuery());
  },
  component: AccountApiKeysSettings,
});

function AccountApiKeysSettings() {
  return (
    <ApiKeysProvider>
      <SettingsTabTitle>Create API Key</SettingsTabTitle>
      <AddApiKeyForm className="mt-3" />
      <SettingsTabTitle className="mt-8">API Keys</SettingsTabTitle>
      <ApiKeysList className="mt-3" />
    </ApiKeysProvider>
  );
}
