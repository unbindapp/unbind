import Charts from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/metrics/_components/charts";
import PageWrapper from "@/components/page-wrapper";

type Props = {
  params: Promise<{
    team_id: string;
    project_id: string;
    environment_id: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { team_id, project_id, environment_id } = await params;
  return (
    <PageWrapper>
      <div className="w-full flex flex-col max-w-7xl">
        <div className="w-full flex flex-wrap items-center justify-between gap-4 px-1">
          <h1 className="w-full font-bold text-2xl leading-tight px-2">
            Metrics
          </h1>
        </div>
        <div className="w-full flex flex-row flex-wrap pt-3">
          <Charts
            teamId={team_id}
            projectId={project_id}
            environmentId={environment_id}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
