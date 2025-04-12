import {
  getProjectPageParams,
  TProjectPageParams,
} from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import GeneralTabContent from "@/app/(project)/[team_id]/project/[project_id]/settings/_components/general-tab-content";

export default async function Page({ params, searchParams }: TProjectPageParams) {
  const { teamId, projectId } = await getProjectPageParams({
    params,
    searchParams,
    currentPathname: `/settings`,
  });
  return <GeneralTabContent teamId={teamId} projectId={projectId} />;
}
