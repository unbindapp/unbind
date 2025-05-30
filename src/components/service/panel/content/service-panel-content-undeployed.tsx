import ErrorLine from "@/components/error-line";
import { UndeployedContentDatabase } from "@/components/service/panel/content/undeployed/service-types/undeployed-database";
import { UndeployedContentDockerImage } from "@/components/service/panel/content/undeployed/service-types/undeployed-docker-image";
import { UndeployedContentGit } from "@/components/service/panel/content/undeployed/service-types/undeployed-git";
import { useService } from "@/components/service/service-provider";
import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { HTMLAttributes, ReactNode } from "react";

type TProps = {
  service: TServiceShallow;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function ServicePanelContentUndeployed({ service }: TProps) {
  const detectedPort =
    service.config.ports && service.config.ports?.length > 0 ? service.config.ports[0].port : null;
  const detectedPortStr = typeof detectedPort === "number" ? detectedPort.toString() : undefined;

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorLine message="Image or tag is not found." />;

    return (
      <Providers service={service}>
        <UndeployedContentDockerImage image={image} tag={tag} detectedPort={detectedPortStr} />
      </Providers>
    );
  }

  if (service.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorLine message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return (
      <Providers service={service}>
        <UndeployedContentGit
          owner={service.git_repository_owner}
          repo={service.git_repository}
          branch={service.config.git_branch}
          installationId={service.github_installation_id}
          detectedPort={detectedPortStr}
        />
      </Providers>
    );
  }

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorLine message="Database type or version is not found." />;
    }

    return (
      <Providers service={service}>
        <UndeployedContentDatabase
          type={service.database_type}
          version={service.database_version}
        />
      </Providers>
    );
  }

  return <ErrorLine message="Service type is not supported." />;
}

function Providers({ service, children }: { service: TServiceShallow; children: ReactNode }) {
  const { teamId, projectId, environmentId } = useService();
  return (
    <VariableReferencesProvider
      type="service"
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
      serviceId={service.id}
      service={service}
    >
      {children}
    </VariableReferencesProvider>
  );
}
