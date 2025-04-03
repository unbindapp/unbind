import GeneralTabContent from "@/app/(project)/[team_id]/project/[project_id]/settings/_components/general-tab-content";

type TProps = {
  params: Promise<{
    team_id: string;
    project_id: string;
    environment_id: string;
  }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId, project_id: projectId } = await params;
  return <GeneralTabContent teamId={teamId} projectId={projectId} />;
}
