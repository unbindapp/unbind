import TabWrapper from "@/components/navigation/tab-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import DeleteSection from "@/components/volume/panel/tabs/settings/sections/delete-section";
import SizeSection from "@/components/volume/panel/tabs/settings/sections/resize-section";
import UsageSection from "@/components/volume/panel/tabs/settings/sections/usage-section";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { ChartNoAxesColumnIcon, FlameIcon, ScalingIcon } from "lucide-react";

export default function Settings({ volume }: { volume: TVolumeShallow }) {
  return (
    <TabWrapper className="pt-4">
      <SettingsSection title="Usage" id="usage" Icon={ChartNoAxesColumnIcon}>
        <UsageSection />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Resize" id="Resize" Icon={ScalingIcon}>
        <SizeSection />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Delete Volume" id="danger" Icon={FlameIcon}>
        <DeleteSection volume={volume} />
      </SettingsSection>
    </TabWrapper>
  );
}
