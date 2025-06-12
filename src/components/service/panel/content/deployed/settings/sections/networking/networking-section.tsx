import ErrorLine from "@/components/error-line";
import AddDomainPortCard from "@/components/service/panel/content/deployed/settings/sections/networking/_components/add-domain-port-card";
import DomainPortCard from "@/components/service/panel/content/deployed/settings/sections/networking/_components/domain-port-card";
import { getNetworkingEntityId } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { GlobeLockIcon, NetworkIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function NetworkingSection({ service }: TProps) {
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

    return <AllServiceTypesSection service={service} />;
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <AllServiceTypesSection service={service} />;
  }

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorWithWrapper message="Database type or version is not found." />;
    }

    return <AllServiceTypesSection service={service} />;
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function AllServiceTypesSection({ service }: { service: TServiceShallow }) {
  const {
    query: { data: endpointsData, isPending: isPendingEndpoints, error: errorEndpoints },
  } = useServiceEndpoints();

  const sectionHighlightId = useMemo(() => getNetworkingEntityId(service), [service]);

  return (
    <SettingsSection
      title="Networking"
      id="networking"
      Icon={NetworkIcon}
      entityId={sectionHighlightId}
    >
      {service.type !== "database" && (
        <Block>
          <BlockItem className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Public Networking</BlockItemTitle>
              <BlockItemDescription>
                Communicate with the service over the internet.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full flex-col gap-2">
                {!endpointsData && !isPendingEndpoints && errorEndpoints && (
                  <ErrorLine
                    message={errorEndpoints.message}
                    className="border-destructive/16 rounded-lg border py-2.5"
                  />
                )}
                {!endpointsData && isPendingEndpoints && (
                  <BlockItemButtonLike
                    isPending={true}
                    key="loading"
                    asElement="div"
                    text="loading.unbind"
                    Icon={({ className }: { className?: string }) => (
                      <GlobeLockIcon className={cn("scale-90", className)} />
                    )}
                  />
                )}
                {endpointsData?.endpoints &&
                  endpointsData.endpoints.external.map((endpoint) => (
                    <DomainPortCard
                      mode="public"
                      key={`${endpoint.host}:${endpoint.target_port?.port}`}
                      domain={endpoint.host}
                      port={endpoint.target_port?.port}
                      service={service}
                    />
                  ))}
                <AddDomainPortCard service={service} isPending={isPendingEndpoints} />
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle>Private Networking</BlockItemTitle>
            <BlockItemDescription>
              {"Communicate with the service from within the Unbind's network."}
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
            <div className="flex w-full flex-col gap-2">
              {!endpointsData && !isPendingEndpoints && errorEndpoints && (
                <ErrorLine
                  message={errorEndpoints.message}
                  className="border-destructive/16 rounded-lg border py-2.5"
                />
              )}
              {!endpointsData && isPendingEndpoints && (
                <BlockItemButtonLike
                  isPending={true}
                  key="loading"
                  asElement="div"
                  text="loading.unbind:3000"
                  Icon={({ className }: { className?: string }) => (
                    <GlobeLockIcon className={cn("scale-90", className)} />
                  )}
                />
              )}
              {endpointsData?.endpoints.internal?.flatMap((endpoint) =>
                endpoint.ports.map((portObject) => (
                  <DomainPortCard
                    mode="private"
                    key={`${endpoint.dns}:${portObject.port}`}
                    domain={endpoint.dns}
                    port={portObject.port}
                    service={service}
                  />
                )),
              )}
              {service.type !== "database" && (
                <AddDomainPortCard
                  service={service}
                  isPending={isPendingEndpoints}
                  mode="private"
                />
              )}
            </div>
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}
