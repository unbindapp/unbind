import { isUUID } from "@/lib/helpers";
import { apiServer } from "@/server/trpc/setup/server";
import { redirect } from "next/navigation";
import { createSearchParamsCache, parseAsString, SearchParams } from "nuqs/server";

export const projectPageSearchParams = createSearchParamsCache({
  environment: parseAsString,
});

export async function getProjectPageSearchParams({
  teamId,
  projectId,
  currentPathname,
  searchParams,
}: {
  teamId: string;
  projectId: string;
  currentPathname: string;
  searchParams: Promise<SearchParams>;
}) {
  const { environment: environmentId } = await projectPageSearchParams.parse(searchParams);

  if (!environmentId || isUUID(environmentId) === false) {
    const res = await apiServer.projects.get({ teamId, projectId });
    const environments = res.project.environments;
    if (environments.length === 0) {
      throw Error("No environments found");
    }
    const environmentId = res.project.default_environment_id || environments[0].id;
    redirect(`${currentPathname}?environment=${environmentId}`);
  }
  return { environmentId };
}

export type TProjectPageParams = {
  params: Promise<{
    team_id: string;
    project_id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

export async function getProjectPageParams({
  params,
  searchParams,
  currentPathname,
}: TProjectPageParams & {
  currentPathname: string;
}) {
  const { team_id: teamId, project_id: projectId } = await params;
  const [{ environmentId }] = await Promise.all([
    getProjectPageSearchParams({
      teamId,
      projectId,
      searchParams,
      currentPathname: `/${teamId}/project/${projectId}` + currentPathname,
    }),
  ]);
  return {
    teamId,
    projectId,
    environmentId,
  };
}
