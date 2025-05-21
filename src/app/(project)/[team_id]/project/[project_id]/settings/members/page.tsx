import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import { ComingSoonCard } from "@/components/coming-soon";
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
      <div className="-mx-1 mt-2 w-[calc(100%+0.5rem)] p-1 md:max-w-3xl">
        <ComingSoonCard />
      </div>
    </>
  );
}
