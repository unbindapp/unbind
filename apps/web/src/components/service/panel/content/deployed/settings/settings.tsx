import TabWrapper from "@/components/navigation/tab-wrapper";
import {
  shouldServiceSettingsHaveBackupsSection,
  shouldServiceSettingsHaveBuildSection,
  shouldServiceSettingsHaveDeploySection,
  shouldServiceSettingsHaveHealthSection,
} from "@/components/service/panel/content/deployed/settings/helpers";
import BackupsSection from "@/components/service/panel/content/deployed/settings/sections/backups-section";
import BuildSection from "@/components/service/panel/content/deployed/settings/sections/build-section";
import DeleteSection from "@/components/service/panel/content/deployed/settings/sections/delete-section";
import DeploySection from "@/components/service/panel/content/deployed/settings/sections/deploy-section";
import HealthSection from "@/components/service/panel/content/deployed/settings/sections/health-section";
import NetworkingSection from "@/components/service/panel/content/deployed/settings/sections/networking/networking-section";
import SourceSection from "@/components/service/panel/content/deployed/settings/sections/source-section";
import { TServiceShallow } from "@/lib/queries/services";

export default function Settings({ service }: { service: TServiceShallow }) {
  return (
    <TabWrapper className="gap-6">
      <SourceSection service={service} />
      <NetworkingSection service={service} />
      {shouldServiceSettingsHaveBackupsSection(service) && <BackupsSection service={service} />}
      {shouldServiceSettingsHaveBuildSection(service) && <BuildSection service={service} />}
      {shouldServiceSettingsHaveDeploySection(service) && <DeploySection service={service} />}
      {shouldServiceSettingsHaveHealthSection(service) && <HealthSection service={service} />}
      <DeleteSection service={service} className="mt-1" />
    </TabWrapper>
  );
}
