import NewServiceButton from "@/components/command-panel/project/new-service-button";
import PageWrapper from "@/components/page-wrapper";
import ServiceCardList from "@/components/project/services/service-card-list";
import { apiServer, HydrateClient } from "@/server/trpc/setup/server";

type Props = {
  params: Promise<{
    team_id: string;
    project_id: string;
    environment_id: string;
  }>;
};

export default async function Page({ params }: Props) {
  const {
    team_id: teamId,
    project_id: projectId,
    environment_id: environmentId,
  } = await params;

  await apiServer.main.getServices.prefetch({
    teamId,
    environmentId,
    projectId,
  });

  return (
    <HydrateClient>
      <PageWrapper>
        <div className="w-full flex flex-col max-w-7xl">
          <div className="w-full flex flex-wrap items-center justify-between gap-4 px-1">
            <h1 className="min-w-0 font-bold leading-tight text-2xl px-2">
              Services
            </h1>
            <NewServiceButton teamId={teamId} projectId={projectId} />
          </div>
          <div className="w-full flex items-center justify-center pt-3">
            <ServiceCardList
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
            />
          </div>
        </div>
      </PageWrapper>
    </HydrateClient>
  );
}
