import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import AddWebhookForm from "@/components/webhook/add-webhook-form";
import WebhooksList from "@/components/webhook/webhooks-list";
import WebhooksProvider from "@/components/webhook/webhooks-provider";

export const Route = createFileRoute("/_authed/$team_id/_team/settings/webhooks/")({
  component: TeamWebhooksSettings,
});

function TeamWebhooksSettings() {
  const { team_id: teamId } = Route.useParams();
  return (
    <WebhooksProvider type="team" teamId={teamId}>
      <SettingsTabTitle>Add Webhooks</SettingsTabTitle>
      <AddWebhookForm className="mt-3" type="team" teamId={teamId} />
      <SettingsTabTitle className="mt-8">Webhooks</SettingsTabTitle>
      <WebhooksList className="mt-3" type="team" teamId={teamId} />
    </WebhooksProvider>
  );
}
