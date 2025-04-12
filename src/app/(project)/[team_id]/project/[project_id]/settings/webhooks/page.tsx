import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import AddWebhookForm from "@/app/(project)/[team_id]/project/[project_id]/settings/webhooks/_components/add-webhook-form";
import WebhooksList from "@/app/(project)/[team_id]/project/[project_id]/settings/webhooks/_components/webhooks-list";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings/webhooks`,
  });
  return (
    <>
      <SettingsTabTitle>Add Webhooks</SettingsTabTitle>
      <AddWebhookForm className="mt-4" />
      <SettingsTabTitle className="mt-8">Webhooks</SettingsTabTitle>
      <WebhooksList className="mt-4" />
    </>
  );
}
