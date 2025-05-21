import { ComingSoonCard } from "@/components/coming-soon";
import SettingsTabTitle from "@/components/settings/settings-tab-title";

export default function Page() {
  return (
    <>
      <SettingsTabTitle>Danger Zone</SettingsTabTitle>
      <div className="-mx-1 mt-2 w-[calc(100%+0.5rem)] p-1 md:max-w-3xl">
        <ComingSoonCard />
      </div>
    </>
  );
}
