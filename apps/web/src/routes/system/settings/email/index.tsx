import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import EmailTabContent from "@/components/system/settings/email-tab-content";
import { emailSettingsQuery } from "@/lib/queries/email";

export const Route = createFileRoute("/system/settings/email/")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(emailSettingsQuery());
  },
  component: SystemEmailSettings,
});

function SystemEmailSettings() {
  return (
    <>
      <SettingsTabTitle>Email</SettingsTabTitle>
      <EmailTabContent className="mt-3" />
    </>
  );
}
