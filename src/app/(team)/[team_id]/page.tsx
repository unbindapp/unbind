import NewProjectButton from "@/components/command-panel/team/new-project-button";
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
          <div className="w-full flex flex-wrap items-center justify-between gap-4 px-1">
            <h1 className="min-w-0 font-bold leading-tight text-2xl px-2">
              Projects
            </h1>
            <NewProjectButton teamId={teamId} />
          </div>
          <div className="w-full flex items-center justify-center pt-3">
            <ProjectCardList teamId={teamId} />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
