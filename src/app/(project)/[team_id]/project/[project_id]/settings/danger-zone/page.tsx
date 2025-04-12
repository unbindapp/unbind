import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import DeleteProjectSection from "@/app/(project)/[team_id]/project/[project_id]/settings/danger-zone/_components/delete-project-section";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings/danger-zone`,
  });
  return (
    <>
      <SettingsTabTitle>Delete Project</SettingsTabTitle>
      <DeleteProjectSection className="mt-4" />
    </>
  );
}
