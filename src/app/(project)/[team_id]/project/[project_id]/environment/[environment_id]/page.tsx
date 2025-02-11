import NewServiceButton from "@/components/command-panel/new-service-button";
import ServiceCardList from "@/components/project/services/service-card-list";
import { apiServer, HydrateClient } from "@/server/trpc/setup/server";

type Props = {
  params: Promise<{ environment_id: string; project_id: string }>;
};

export default async function Page({ params }: Props) {
  const { environment_id: environmentId, project_id: projectId } = await params;
  await apiServer.main.getServices.prefetch({ environmentId, projectId });

  return (
    <HydrateClient>
      <div className="w-full flex flex-col items-center px-3 md:px-8 pt-4 md:pt-6 pb-16">
        <div className="w-full flex flex-col max-w-5xl">
          <div className="w-full flex items-center justify-between pl-3 pr-1 gap-4">
            <h1 className="flex-1 min-w-0 font-bold leading-tight text-2xl">
              Services
            </h1>
            <NewServiceButton />
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
