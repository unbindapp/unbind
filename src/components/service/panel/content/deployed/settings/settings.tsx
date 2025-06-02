import TabWrapper from "@/components/navigation/tab-wrapper";
import BuildSection from "@/components/service/panel/content/deployed/settings/sections/build-section";
import DeleteSection from "@/components/service/panel/content/deployed/settings/sections/delete-section";
import DeploySection from "@/components/service/panel/content/deployed/settings/sections/deploy-section";
import NetworkingSection from "@/components/service/panel/content/deployed/settings/sections/networking-section";
import SourceSection from "@/components/service/panel/content/deployed/settings/sections/source-section";
import { SettingsSection } from "@/components/settings/settings-section";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { CodeIcon, NetworkIcon, RocketIcon, Trash2Icon, WrenchIcon } from "lucide-react";

export default function Settings({ service }: { service: TServiceShallow }) {
  return (
    <TabWrapper className="gap-6">
      <SettingsSection title="Source" id="source" Icon={CodeIcon}>
        <SourceSection service={service} />
      </SettingsSection>
      <SettingsSection title="Networking" id="networking" Icon={NetworkIcon}>
        <NetworkingSection service={service} />
      </SettingsSection>
      {service.type === "github" && (
        <>
          <SettingsSection title="Build" id="build" Icon={WrenchIcon}>
            <BuildSection service={service} />
          </SettingsSection>
        </>
      )}
      {(service.type === "github" || service.type === "docker-image") && (
        <SettingsSection title="Deploy" id="deploy" Icon={RocketIcon}>
          <DeploySection service={service} />
        </SettingsSection>
      )}
      <SettingsSection
        className="border-destructive/20"
        classNameHeader="text-destructive bg-destructive/8 border-destructive/15"
        title="Delete Service"
        id="danger"
        Icon={Trash2Icon}
      >
        <DeleteSection service={service} className="mt-1" />
      </SettingsSection>
    </TabWrapper>
  );
}
