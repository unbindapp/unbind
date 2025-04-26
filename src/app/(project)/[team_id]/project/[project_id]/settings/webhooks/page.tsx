import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import AddWebhookForm from "@/components/webhook/add-webhook-form";
import WebhooksList from "@/components/webhook/webhooks-list";
import WebhooksProvider from "@/components/webhook/webhooks-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  const { teamId, projectId } = await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings/webhooks`,
  });

  const initialData = await ResultAsync.fromPromise(
    apiServer.webhooks.list({
      type: "project",
      teamId,
      projectId,
    }),
    () => new Error("Failed to fetch webhooks"),
  );

  return (
    <WebhooksProvider
      type="project"
      teamId={teamId}
      projectId={projectId}
      initialData={initialData.isOk() ? initialData.value : undefined}
    >
      <SettingsTabTitle>Add Webhooks</SettingsTabTitle>
      <AddWebhookForm className="mt-3" type="project" teamId={teamId} projectId={projectId} />
      <SettingsTabTitle className="mt-8">Webhooks</SettingsTabTitle>
      <WebhooksList className="mt-3" type="project" teamId={teamId} projectId={projectId} />
    </WebhooksProvider>
  );
}
