import { createFileRoute } from "@tanstack/react-router";

import SettingsTabTitle from "@/components/settings/settings-tab-title";
import AddWebhookForm from "@/components/webhook/add-webhook-form";
import WebhooksList from "@/components/webhook/webhooks-list";
import WebhooksProvider from "@/components/webhook/webhooks-provider";

export const Route = createFileRoute("/_authed/$team_id/project/$project_id/settings/webhooks/")({
  component: ProjectWebhooksSettings,
});

function ProjectWebhooksSettings() {
  const { team_id: teamId, project_id: projectId } = Route.useParams();
  return (
    <WebhooksProvider type="project" teamId={teamId} projectId={projectId}>
      <SettingsTabTitle>Add Webhooks</SettingsTabTitle>
      <AddWebhookForm className="mt-3" type="project" teamId={teamId} projectId={projectId} />
      <SettingsTabTitle className="mt-8">Webhooks</SettingsTabTitle>
      <WebhooksList className="mt-3" type="project" teamId={teamId} projectId={projectId} />
    </WebhooksProvider>
  );
}
