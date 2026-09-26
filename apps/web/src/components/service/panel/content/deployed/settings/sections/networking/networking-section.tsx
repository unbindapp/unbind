import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import ErrorLine from "@/components/error-line";
import { networkAccessLabel } from "@/components/service/network-access";
import AddDomainPortCard from "@/components/service/panel/content/deployed/settings/sections/networking/_components/add-domain-port-card";
import DatabaseEndpointCard, {
  DatabasePendingEndpointRow,
} from "@/components/service/panel/content/deployed/settings/sections/networking/_components/database-endpoint-card";
import DatabaseNetworkAccess from "@/components/service/panel/content/deployed/settings/sections/networking/_components/database-network-access";
import DomainPortCard from "@/components/service/panel/content/deployed/settings/sections/networking/_components/domain-port-card";
import { getNetworkingEntityId } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import MaxRequestSize, {
  unsetRequestSizeMb,
} from "@/components/service/panel/content/deployed/settings/sections/networking/_components/max-request-size";
import { useSettingsSectionSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import {
  hasApplying,
  networkAccessFields,
  requestSizeFields,
  stagedBoolean,
  useServiceChanges,
  useStagedNetworking,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { settingsIds } from "@/components/settings/settings-ids";
import { SettingsSection } from "@/components/settings/settings-section";
import { useSystem } from "@/components/system/system-provider";
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
  const serverRequestSizeMb = service.config.max_request_body_size_mb ?? unsetRequestSizeMb;
  const { staged, stage, unstage } = useServiceChanges(service, {
    isPublic: service.config.is_public,
    maxRequestBodySizeMb: serverRequestSizeMb,
  });
  const { data: systemData } = useSystem();

  const { staged: stagedLists, unstage: unstageLists } = useStagedNetworking(service);
  const stagedHosts = stagedLists.filter((change) => change.kind === "host");
  const stagedPorts = stagedLists.filter((change) => change.kind === "port");
  const addedHosts = stagedHosts.filter((change) => change.previous === null);
  const addedPorts = stagedPorts.filter((change) => change.op === "add");

  // The address is the same for every port of the service
  const privateDomain = endpointsData?.endpoints.internal?.[0]?.dns ?? service.kubernetes_name;

  const isDatabase = service.type === "database";
  const subject = isDatabase ? "database" : "service";
  // A database that is staged private loses its public block before it is applied,
  // and one that is staged public gets it right away, with nothing in it yet
  const isPublic = stagedBoolean(staged.isPublic, service.config.is_public);
  // Nothing is being allocated until the change is applied
  const isAwaitingAddress = staged.isPublic === undefined;
  const showAccess = isDatabase && isItemVisible(settingsIds.networking.access);
  const showPublic = isItemVisible(settingsIds.networking.public) && (!isDatabase || isPublic);
  const showPrivate = isItemVisible(settingsIds.networking.private);
  // Gateway clusters stream request bodies without a limit
  const showRequestSize =
    !isDatabase &&
    systemData !== undefined &&
    systemData.data.networking_provider !== "gateway" &&
    isItemVisible(settingsIds.networking.maxRequestSize);
  if (!showAccess && !showPublic && !showPrivate && !showRequestSize) return null;
  const sectionFields = [...networkAccessFields, ...requestSizeFields];

  return (
    <SettingsSection
      title="Networking"
      id="networking"
      Icon={NetworkIcon}
      entityId={sectionHighlightId}
      hasChanges={
        sectionFields.some((field) => staged[field] !== undefined) || stagedLists.length > 0
      }
      isApplying={
        hasApplying(staged, sectionFields) || stagedLists.some((change) => change.isApplying)
      }
      onDiscard={() => {
        unstage(sectionFields);
        unstageLists();
      }}
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
                {`Communicate with the ${subject} over the internet.`}
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
                      <GlobeLockIcon className={className} />
                    )}
                  />
                )}
                {endpointsData?.endpoints &&
                  !isDatabase &&
                  service.config.hosts.map((saved) => {
                    const endpoint = endpointsData.endpoints.external.find(
                      (e) => e.host === saved.host,
                    );
                    const change = stagedHosts.find((c) => c.previous?.host === saved.host);
                    const shown = change?.value ?? { host: saved.host, port: saved.target_port };
                    return (
                      <DomainPortCard
                        mode="public"
                        key={`${saved.host}:${shown.host}:${shown.port}`}
                        domain={shown.host}
                        port={shown.port}
                        dnsStatus={endpoint?.dns_status}
                        isCloudflare={endpoint?.is_cloudflare}
                        service={service}
                        staged={change}
                      />
                    );
                  })}
                {endpointsData?.endpoints &&
                  !isDatabase &&
                  addedHosts.map((change) => (
                    <DomainPortCard
                      mode="public"
                      key={`${change.id}:${change.value?.port}`}
                      domain={change.value?.host ?? ""}
                      port={change.value?.port}
                      service={service}
                      staged={change}
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
                  endpointsData?.endpoints.external.length === 0 && (
                    <DatabasePendingEndpointRow isWaiting={isAwaitingAddress} />
                  )}
                {!isDatabase && (
                  <AddDomainPortCard
                    service={service}
                    staged={stagedLists}
                    isPending={isPendingEndpoints}
                  />
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
                {`Communicate with the ${subject} from within the Unbind's network.`}
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
                      <GlobeLockIcon className={className} />
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
                        staged={stagedPorts.find(
                          (c) => c.op === "remove" && c.port === portObject.port,
                        )}
                      />
                    ),
                  ),
                )}
                {endpointsData?.endpoints &&
                  !isDatabase &&
                  addedPorts.map((change) => (
                    <DomainPortCard
                      mode="private"
                      key={change.id}
                      domain={privateDomain}
                      port={change.port}
                      service={service}
                      staged={change}
                    />
                  ))}
                {service.type !== "database" && (
                  <AddDomainPortCard
                    service={service}
                    staged={stagedLists}
                    isPending={isPendingEndpoints}
                    mode="private"
                  />
                )}
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      {showRequestSize && (
        <Block>
          <BlockItem id={settingsIds.networking.maxRequestSize} className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Max Request Size</BlockItemTitle>
              <BlockItemDescription>
                Requests above this size are refused by the service.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <MaxRequestSize
                serverSizeMb={serverRequestSizeMb}
                staged={staged}
                stage={(sizeMb) =>
                  stage({
                    field: "maxRequestBodySizeMb",
                    label: "Max request size",
                    value: sizeMb,
                    previous: serverRequestSizeMb,
                    format: (v) => (v === unsetRequestSizeMb ? "Default" : `${v} MB`),
                  })
                }
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </SettingsSection>
  );
}
