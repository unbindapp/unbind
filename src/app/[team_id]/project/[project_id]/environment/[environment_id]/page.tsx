import ServiceCardList from "@/app/[team_id]/project/[project_id]/environment/_components/service-card-list";
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
          <h1 className="w-full px-3 font-bold text-2xl">Services</h1>
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
