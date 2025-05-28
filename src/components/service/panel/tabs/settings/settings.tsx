import TabWrapper from "@/components/navigation/tab-wrapper";
import BuildSection from "@/components/service/panel/tabs/settings/sections/build-section";
import DeleteSection from "@/components/service/panel/tabs/settings/sections/delete-section";
import DeploySection from "@/components/service/panel/tabs/settings/sections/deploy-section";
import NetworkingSection from "@/components/service/panel/tabs/settings/sections/networking-section";
import SourceSection from "@/components/service/panel/tabs/settings/sections/source-section";
import { SettingsSection } from "@/components/settings/settings-section";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { CodeIcon, NetworkIcon, RocketIcon, Trash2Icon, WrenchIcon } from "lucide-react";

export default function Settings({ service }: { service: TServiceShallow }) {
  return (
    <TabWrapper className="pt-4">
      <SettingsSection title="Source" id="source" Icon={CodeIcon}>
        <SourceSection service={service} />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Networking" id="networking" Icon={NetworkIcon}>
        <NetworkingSection service={service} />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Build" id="build" Icon={WrenchIcon}>
        <BuildSection service={service} />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Deploy" id="deploy" Icon={RocketIcon}>
        <DeploySection service={service} />
      </SettingsSection>
      <SettingsSection className="pt-8" title="Delete Service" id="danger" Icon={Trash2Icon}>
        <DeleteSection service={service} className="mt-1" />
      </SettingsSection>
    </TabWrapper>
  );
}
