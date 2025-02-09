import ProjectCardList from "@/app/[team_id]/_components/project-card-list";
import { apiServer, HydrateClient } from "@/server/trpc/setup/server";

type Props = {
  params: Promise<{ team_id: string }>;
};

export default async function Page({ params }: Props) {
  const { team_id: teamId } = await params;
  await apiServer.main.getProjects.prefetch({ teamId });

  return (
    <HydrateClient>
      <div className="w-full flex flex-col items-center px-3 md:px-8 pt-4 md:pt-7 pb-16">
        <div className="w-full flex flex-col max-w-5xl">
          <h1 className="w-full px-3 font-bold text-xl">Projects</h1>
          <div className="w-full flex items-center justify-center pt-3">
            <ProjectCardList teamId={teamId} />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
