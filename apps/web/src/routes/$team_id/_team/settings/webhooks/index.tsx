import { createFileRoute } from "@tanstack/react-router";

import { webhooksListQuery } from "@/api/queries/webhooks";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import AddWebhookForm from "@/components/webhook/add-webhook-form";
import WebhooksList from "@/components/webhook/webhooks-list";
import WebhooksProvider from "@/components/webhook/webhooks-provider";

export const Route = createFileRoute("/$team_id/_team/settings/webhooks/")({
  // Runs on intent preload (hover) so hovering the tab warms the cache
  // before navigation. Non-blocking; the provider shows skeletons meanwhile.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(webhooksListQuery({ type: "team", teamId: params.team_id }));
  },
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
