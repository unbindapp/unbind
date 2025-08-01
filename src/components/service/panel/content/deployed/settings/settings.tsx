import TabWrapper from "@/components/navigation/tab-wrapper";
import BackupsSection from "@/components/service/panel/content/deployed/settings/sections/backups-section";
import BuildSection from "@/components/service/panel/content/deployed/settings/sections/build-section";
import DeleteSection from "@/components/service/panel/content/deployed/settings/sections/delete-section";
import DeploySection from "@/components/service/panel/content/deployed/settings/sections/deploy-section";
import HealthSection from "@/components/service/panel/content/deployed/settings/sections/health-section";
import NetworkingSection from "@/components/service/panel/content/deployed/settings/sections/networking/networking-section";
import SourceSection from "@/components/service/panel/content/deployed/settings/sections/source-section";
import { TServiceShallow } from "@/server/trpc/api/services/types";

export default function Settings({ service }: { service: TServiceShallow }) {
  return (
    <TabWrapper className="gap-6">
      <SourceSection service={service} />
      <NetworkingSection service={service} />
      {service.type === "database" && <BackupsSection service={service} />}
      {service.type === "github" && <BuildSection service={service} />}
      {(service.type === "github" || service.type === "docker-image") && (
        <DeploySection service={service} />
      )}
      {(service.type === "github" || service.type === "docker-image") && (
        <HealthSection service={service} />
      )}
      <DeleteSection service={service} className="mt-1" />
    </TabWrapper>
  );
}
