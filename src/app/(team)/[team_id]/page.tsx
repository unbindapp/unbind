import PageWrapper from "@/components/page-wrapper";
import ProjectsProvider from "@/components/project/projects-provider";
import NewProjectButton from "@/components/team/new-project-button";
import ProjectCardList from "@/components/team/project-card-list";
import { apiServer } from "@/server/trpc/setup/server";
import { Metadata } from "next";
import { ResultAsync } from "neverthrow";

type TProps = {
  params: Promise<{ team_id: string }>;
};

export const metadata: Metadata = {};

export default async function Page({ params }: TProps) {
  const { team_id: teamId } = await params;

  const initialData = await ResultAsync.fromPromise(
    apiServer.projects.list({
      teamId,
    }),
    () => new Error("Failed to fetch projects"),
  );

  if (initialData.isErr()) {
    throw new Error(initialData.error.message);
  }

  return (
    <ProjectsProvider teamId={teamId} initialData={initialData.value}>
      <PageWrapper>
        <div className="flex w-full max-w-7xl flex-col">
          <div className="flex w-full flex-wrap items-center justify-between gap-4 px-1">
            <h1 className="min-w-0 px-2 text-2xl leading-tight font-bold">Projects</h1>
            <NewProjectButton teamId={teamId} />
          </div>
          <div className="flex w-full items-center justify-center pt-3">
            <ProjectCardList teamId={teamId} />
          </div>
        </div>
      </PageWrapper>
    </ProjectsProvider>
  );
}
