import { useSettingsSectionSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import { settingsIds } from "@/components/settings/settings-ids";
import ErrorLine from "@/components/error-line";
import AddDomainPortCard from "@/components/service/panel/content/deployed/settings/sections/networking/_components/add-domain-port-card";
import DomainPortCard from "@/components/service/panel/content/deployed/settings/sections/networking/_components/domain-port-card";
import DatabaseEndpointCard, {
  DatabasePendingEndpointRow,
} from "@/components/service/panel/content/deployed/settings/sections/networking/_components/database-endpoint-card";
import { getNetworkingEntityId } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import { networkAccessLabel } from "@/components/service/network-access";
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import DatabaseNetworkAccess from "@/components/service/panel/content/deployed/settings/sections/networking/_components/database-network-access";
import {
  hasApplying,
  networkAccessFields,
  stagedBoolean,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/lib/queries/services";
import { GlobeLockIcon, NetworkIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function NetworkingSection({ service }: TProps) {
  const { isSectionVisible } = useSettingsSectionSearch("networking");
  if (!isSectionVisible) return null;
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

  const { isItemVisible } = useSettingsSectionSearch("networking");
  const sectionHighlightId = useMemo(() => getNetworkingEntityId(service.id), [service.id]);
  const { staged, stage, unstage } = useServiceChanges(service, {
    isPublic: service.config.is_public,
  });

  const isDatabase = service.type === "database";
  // A database that is staged private loses its public block before it is applied,
  // and one that is staged public gets it right away, with nothing in it yet
  const isPublic = stagedBoolean(staged.isPublic, service.config.is_public);
  const showAccess = isDatabase && isItemVisible(settingsIds.networking.access);
  const showPublic = isItemVisible(settingsIds.networking.public) && (!isDatabase || isPublic);
  const showPrivate = isItemVisible(settingsIds.networking.private);
  if (!showAccess && !showPublic && !showPrivate) return null;

  return (
    <SettingsSection
      title="Networking"
      id="networking"
      Icon={NetworkIcon}
      entityId={sectionHighlightId}
      hasChanges={staged.isPublic !== undefined}
      isApplying={hasApplying(staged, networkAccessFields)}
      onDiscard={() => unstage(networkAccessFields)}
    >
      {showAccess && (
        <Block>
          <BlockItem id={settingsIds.networking.access} className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Network Access</BlockItemTitle>
              <BlockItemDescription>
                Whether the database is reachable from the internet.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <DatabaseNetworkAccess
                service={service}
                staged={staged}
                stage={(isPublic) =>
                  stage({
                    field: "isPublic",
                    label: "Network access",
                    value: isPublic,
                    previous: service.config.is_public,
                    format: (value) => networkAccessLabel(value),
                  })
                }
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      {showPublic && (
        <Block>
          <BlockItem id={settingsIds.networking.public} className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Public Networking</BlockItemTitle>
              <BlockItemDescription>
                {isDatabase
                  ? "Reach the database from outside the cluster."
                  : "Communicate with the service over the internet."}
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full flex-col gap-2">
                {!endpointsData && !isPendingEndpoints && errorEndpoints && (
                  <ErrorLine
                    message={errorEndpoints.message}
                    className="border-destructive/5-10 rounded-lg border py-2.5"
                  />
                )}
                {!endpointsData && isPendingEndpoints && (
                  <BlockItemButtonLike
                    isPending={true}
                    key="loading"
                    asElement="div"
                    text="loading.unbind"
                    Icon={({ className }: { className?: string }) => (
                      <GlobeLockIcon className={cn(className, "size-4.5")} />
                    )}
                  />
                )}
                {endpointsData?.endpoints &&
                  !isDatabase &&
                  endpointsData.endpoints.external.map((endpoint) => (
                    <DomainPortCard
                      mode="public"
                      key={`${endpoint.host}:${endpoint.target_port?.port}`}
                      domain={endpoint.host}
                      port={endpoint.target_port?.port}
                      dnsStatus={endpoint.dns_status}
                      isCloudflare={endpoint.is_cloudflare}
                      service={service}
                    />
                  ))}
                {endpointsData?.endpoints &&
                  isDatabase &&
                  endpointsData.endpoints.external.map((endpoint) => (
                    <DatabaseEndpointCard
                      mode="public"
                      key={`${endpoint.host}:${endpoint.target_port?.port}`}
                      domain={endpoint.host}
                      port={endpoint.target_port?.port}
                    />
                  ))}
                {isDatabase &&
                  !isPendingEndpoints &&
                  endpointsData?.endpoints.external.length === 0 && <DatabasePendingEndpointRow />}
                {!isDatabase && (
                  <AddDomainPortCard service={service} isPending={isPendingEndpoints} />
                )}
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      {showPrivate && (
        <Block>
          <BlockItem id={settingsIds.networking.private} className="w-full md:w-full">
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
                    className="border-destructive/5-10 rounded-lg border py-2.5"
                  />
                )}
                {!endpointsData && isPendingEndpoints && (
                  <BlockItemButtonLike
                    isPending={true}
                    key="loading"
                    asElement="div"
                    text="loading.unbind:3000"
                    Icon={({ className }: { className?: string }) => (
                      <GlobeLockIcon className={cn(className, "size-4.5")} />
                    )}
                  />
                )}
                {endpointsData?.endpoints.internal?.flatMap((endpoint) =>
                  endpoint.ports.map((portObject) =>
                    isDatabase ? (
                      <DatabaseEndpointCard
                        mode="private"
                        key={`${endpoint.dns}:${portObject.port}`}
                        domain={endpoint.dns}
                        port={portObject.port}
                      />
                    ) : (
                      <DomainPortCard
                        mode="private"
                        key={`${endpoint.dns}:${portObject.port}`}
                        domain={endpoint.dns}
                        port={portObject.port}
                        service={service}
                      />
                    ),
                  ),
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
      )}
    </SettingsSection>
  );
}
