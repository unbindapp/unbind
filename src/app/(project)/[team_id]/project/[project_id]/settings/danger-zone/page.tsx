import DeleteProjectSection from "@/app/(project)/[team_id]/project/[project_id]/settings/danger-zone/delete-project-section";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export default function Page() {
  return (
    <>
      <SettingsTabTitle>Delete Project</SettingsTabTitle>
      <DeleteProjectSection className="mt-4" />
    </>
  );
}
