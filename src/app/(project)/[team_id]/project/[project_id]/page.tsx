import { getProjectPageParams } from "@/app/(project)/[team_id]/project/[project_id]/_components/search-params";
import PageWrapper from "@/components/page-wrapper";
import NewServiceButton from "@/components/project/new-service-button";
import ServiceCardList from "@/components/project/service-card-list";
import ServicesProvider from "@/components/project/services-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { notFound } from "next/navigation";
import { type SearchParams } from "nuqs/server";

type TProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
  }>;
  searchParams: Promise<SearchParams>;
};

export default async function Page({ params, searchParams }: TProps) {
  const { teamId, projectId, environmentId } = await getProjectPageParams({
    params,
    searchParams,
    currentPathname: ``,
  });

  const initialData = await ResultAsync.fromPromise(
    apiServer.services.list({
      teamId,
      projectId,
      environmentId,
    }),
    () => new Error("Failed to fetch services"),
  );

  if (initialData.isErr()) {
    return notFound();
  }

  return (
    <ServicesProvider
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      initialData={initialData.value}
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
