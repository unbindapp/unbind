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
    const environmentId = environments[0].id;
    redirect(`${currentPathname}?environment=${environmentId}`);
  }
  return { environmentId };
}
