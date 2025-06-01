import ErrorWithWrapper from "@/components/service/panel/content/deployed/settings/shared/error-with-wrapper";
import SettingsSectionWrapper from "@/components/service/panel/content/deployed/settings/shared/settings-section-wrapper";
import { TServiceShallow } from "@/server/trpc/api/services/types";

type TProps = {
  service: TServiceShallow;
};

export default function BuildSection({ service }: TProps) {
  if (service.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorWithWrapper message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return <SettingsSectionWrapper>Github</SettingsSectionWrapper>;
  }

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorWithWrapper message="Database type or version is not found." />;
    }

    return <SettingsSectionWrapper>Database</SettingsSectionWrapper>;
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <SettingsSectionWrapper>Docker</SettingsSectionWrapper>;
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}
