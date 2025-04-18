import SettingsTabTitle from "@/components/settings/settings-tab-title";
import AddWebhookForm from "@/components/webhook/add-webhook-form";
import WebhooksList from "@/components/webhook/webhooks-list";
import WebhooksProvider from "@/components/webhook/webhooks-provider";

type TProps = {
  params: Promise<{ team_id: string }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId } = await params;
  return (
    <WebhooksProvider type="team" teamId={teamId}>
      <SettingsTabTitle>Add Webhooks</SettingsTabTitle>
      <AddWebhookForm className="mt-3" type="team" teamId={teamId} />
      <SettingsTabTitle className="mt-8">Webhooks</SettingsTabTitle>
      <WebhooksList className="mt-3" type="team" teamId={teamId} />
    </WebhooksProvider>
  );
}
