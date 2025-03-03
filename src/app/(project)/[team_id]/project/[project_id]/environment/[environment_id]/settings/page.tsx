import GeneralTabContent from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/settings/_components/general-tab-content";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export default function Page() {
  return (
    <>
      <SettingsTabTitle>General</SettingsTabTitle>
      <GeneralTabContent />
    </>
  );
}
