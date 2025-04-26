import SettingsTabTitle from "@/components/settings/settings-tab-title";
import AddWebhookForm from "@/components/webhook/add-webhook-form";
import WebhooksList from "@/components/webhook/webhooks-list";
import WebhooksProvider from "@/components/webhook/webhooks-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";

type TProps = {
  params: Promise<{ team_id: string }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId } = await params;

  const initialData = await ResultAsync.fromPromise(
    apiServer.webhooks.list({
      type: "team",
      teamId,
    }),
    () => new Error("Failed to fetch webhooks"),
  );

  return (
    <WebhooksProvider
      type="team"
      teamId={teamId}
      initialData={initialData.isOk() ? initialData.value : undefined}
    >
      <SettingsTabTitle>Add Webhooks</SettingsTabTitle>
      <AddWebhookForm className="mt-3" type="team" teamId={teamId} />
      <SettingsTabTitle className="mt-8">Webhooks</SettingsTabTitle>
      <WebhooksList className="mt-3" type="team" teamId={teamId} />
    </WebhooksProvider>
  );
}
