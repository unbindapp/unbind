import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import WebhooksList from "@/components/webhook/webhooks-list";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import WebhooksProvider from "@/components/webhook/webhooks-provider";
import AddWebhookForm from "@/components/webhook/add-webhook-form";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { notFound } from "next/navigation";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  const { teamId, projectId } = await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings/webhooks`,
  });

  const [initialData] = await Promise.all([
    ResultAsync.fromPromise(
      apiServer.webhooks.list({
        type: "project",
        teamId,
        projectId,
      }),
      () => new Error("Failed to fetch webhooks"),
    ),
  ]);

  if (initialData.isErr()) {
    return notFound();
  }

  return (
    <WebhooksProvider
      type="project"
      teamId={teamId}
      projectId={projectId}
      initialData={initialData.value}
    >
      <SettingsTabTitle>Add Webhooks</SettingsTabTitle>
      <AddWebhookForm className="mt-3" type="project" teamId={teamId} projectId={projectId} />
      <SettingsTabTitle className="mt-8">Webhooks</SettingsTabTitle>
      <WebhooksList className="mt-3" type="project" teamId={teamId} projectId={projectId} />
    </WebhooksProvider>
  );
}
