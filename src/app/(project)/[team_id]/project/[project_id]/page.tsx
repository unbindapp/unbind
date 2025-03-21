import { getProjectPageSearchParams } from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import PageWrapper from "@/components/page-wrapper";
import NewServiceButton from "@/components/project/command-panel/new-service-button";
import ServiceCardList from "@/components/service/service-card-list";
import ServicesProvider from "@/components/service/services-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { type SearchParams } from "nuqs/server";

type TProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

export default async function Page({ params, searchParams }: TProps) {
  const { team_id: teamId, project_id: projectId } = await params;
  const { environmentId } = await getProjectPageSearchParams({
    teamId,
    projectId,
    searchParams,
    currentPathname: `/${teamId}/project/${projectId}`,
  });

  const initialData = await apiServer.services.list({
    teamId,
    projectId,
    environmentId,
  });

  return (
    <ServicesProvider
      initialData={initialData}
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
    >
      <PageWrapper>
        <div className="flex w-full max-w-7xl flex-col">
          <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
            <h1 className="min-w-0 px-2 text-2xl leading-tight font-bold">Services</h1>
            <NewServiceButton />
          </div>
          <div className="flex w-full items-center justify-center pt-3">
            <ServiceCardList />
          </div>
        </div>
      </PageWrapper>
    </ServicesProvider>
  );
}
