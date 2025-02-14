import NewServiceButton from "@/components/command-panel/new-service-button";
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
  await apiServer.main.getServices.prefetch({ environmentId, projectId });

  return (
    <HydrateClient>
      <div className="w-full flex flex-col items-center px-3 md:px-8 pt-5 md:pt-7 pb-16">
        <div className="w-full flex flex-col max-w-5xl">
          <div className="w-full flex items-center justify-between pl-3 pr-1 gap-4">
            <h1 className="flex-1 min-w-0 font-bold leading-tight text-2xl">
              Services
            </h1>
            <NewServiceButton teamId={teamId} projectId={projectId} />
          </div>
          <div className="w-full flex items-center justify-center pt-3">
            <ServiceCardList
              projectId={projectId}
              environmentId={environmentId}
            />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
