import ProjectCardList from "@/components/team/project-card-list";
import { apiServer, HydrateClient } from "@/server/trpc/setup/server";
import { Metadata } from "next";

type Props = {
  params: Promise<{ team_id: string }>;
};

export const metadata: Metadata = {};

export default async function Page({ params }: Props) {
  const { team_id: teamId } = await params;
  await apiServer.main.getProjects.prefetch({ teamId });

  return (
    <HydrateClient>
      <div className="w-full flex flex-col items-center px-3 md:px-8 pt-5 md:pt-7 pb-16">
        <div className="w-full flex flex-col max-w-5xl">
          <div className="w-full flex items-center justify-between pl-3 pr-1 gap-4">
            <h1 className="flex-1 min-w-0 font-bold leading-tight text-2xl">
              Projects
            </h1>
          </div>
          <div className="w-full flex items-center justify-center pt-3">
            <ProjectCardList teamId={teamId} />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
