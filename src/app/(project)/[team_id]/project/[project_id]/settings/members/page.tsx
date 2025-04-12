import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings/members`,
  });
  return (
    <>
      <SettingsTabTitle>Members</SettingsTabTitle>
    </>
  );
}
