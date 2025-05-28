import TabWrapper from "@/components/navigation/tab-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import MountedPathSection from "@/components/volume/panel/tabs/settings/sections/connection-section";
import DeleteSection from "@/components/volume/panel/tabs/settings/sections/delete-section";
import ExpandSection from "@/components/volume/panel/tabs/settings/sections/expand-section";
import UsageSection from "@/components/volume/panel/tabs/settings/sections/usage-section";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { ChartNoAxesColumnIcon, ScalingIcon, Trash2Icon, UnplugIcon } from "lucide-react";

type TProps = { volume: TVolumeShallow };

export default function Settings({ volume }: TProps) {
  return (
    <TabWrapper className="pt-0 sm:pt-0">
      <SettingsSection
        className="pt-4 sm:pt-6"
        title="Usage"
        id="usage"
        Icon={ChartNoAxesColumnIcon}
      >
        <UsageSection volume={volume} />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Expand" id="expand" Icon={ScalingIcon}>
        <ExpandSection volume={volume} />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Connection" id="connection" Icon={UnplugIcon}>
        <MountedPathSection volume={volume} />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Delete Volume" id="danger" Icon={Trash2Icon}>
        <DeleteSection volume={volume} className="mt-1" />
      </SettingsSection>
    </TabWrapper>
  );
}
