import NewServiceButton from "@/components/project/command-panel/new-service-button";
import PageWrapper from "@/components/page-wrapper";
import ServiceCardList from "@/components/service/service-card-list";
import { apiServer, HydrateClient } from "@/server/trpc/setup/server";

type TProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
    environment_id: string;
  }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId, project_id: projectId, environment_id: environmentId } = await params;

  await apiServer.main.getServices.prefetch({
    teamId,
    environmentId,
    projectId,
  });

  return (
    <HydrateClient>
      <PageWrapper>
        <div className="flex w-full max-w-7xl flex-col">
          <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
            <h1 className="min-w-0 px-2 text-2xl leading-tight font-bold">Services</h1>
            <NewServiceButton teamId={teamId} projectId={projectId} />
          </div>
          <div className="flex w-full items-center justify-center pt-3">
            <ServiceCardList teamId={teamId} projectId={projectId} environmentId={environmentId} />
          </div>
        </div>
      </PageWrapper>
    </HydrateClient>
  );
}
