import GeneralTabContent from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/settings/_components/general-tab-content";
import TabTitle from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/settings/_components/tab-title";

export default function Page() {
  return (
    <>
      <TabTitle>General</TabTitle>
      <GeneralTabContent />
    </>
  );
}
