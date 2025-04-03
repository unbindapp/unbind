import GeneralTabContent from "@/app/(team)/[team_id]/settings/_components/general-tab-content";

type TProps = {
  params: Promise<{
    team_id: string;
  }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId } = await params;
  return <GeneralTabContent teamId={teamId} />;
}
