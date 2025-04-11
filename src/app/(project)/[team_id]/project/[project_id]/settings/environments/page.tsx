import EnvironmentsTabContent from "@/app/(project)/[team_id]/project/[project_id]/settings/environments/_components/environments-tab-content";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export default function Page() {
  return (
    <>
      <SettingsTabTitle>Environments</SettingsTabTitle>
      <EnvironmentsTabContent />
    </>
  );
}
