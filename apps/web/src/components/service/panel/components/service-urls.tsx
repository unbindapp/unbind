import ServiceUrl, { PendingServiceUrl } from "@/components/service/panel/components/service-url";
import { useDraftDomain } from "@/components/service/panel/draft-domain-provider";
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import { TExternalEndpoint, TServiceShallow } from "@/lib/queries/services";
import { ReactNode, useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

// NodePort discovery reports the same L4 endpoint once per cluster node. One is
// enough here; the networking section lists every node.
function collapseEndpoints(endpoints: TExternalEndpoint[] | undefined) {
  if (!endpoints) return undefined;
  const seen = new Set<number>();
  return endpoints.filter((endpoint) => {
    if (endpoint.is_ingress || endpoint.target_port === undefined) return true;
    if (seen.has(endpoint.target_port.port)) return false;
    seen.add(endpoint.target_port.port);
    return true;
  });
}

export default function ServiceUrls({ service }: TProps) {
  const { draftDomain } = useDraftDomain();
  const {
    query: { data, error },
  } = useServiceEndpoints();

  const endpoints = useMemo(() => collapseEndpoints(data?.endpoints.external), [data]);

  // An undeployed service has no endpoint yet, only the domain its deploy form
  // will use. Databases have none, a public one gets its address once it is deployed.
  if (!service.last_deployment) {
    if (!draftDomain) return null;
    return (
      <Row>
        <PendingServiceUrl host={draftDomain} path="/" dnsStatus="unknown" tlsStatus="pending" />
      </Row>
    );
  }

  if (!service.config.is_public) return null;

  const hosts = service.config.hosts || [];
  const isDatabase = service.type === "database";
  // A public database is reached at an allocated port, so it has no host to gate on
  if (!isDatabase && hosts.length < 1) return null;

  // A database made public after its first deploy has no address until the port is discovered
  const isAwaitingEndpoints = !endpoints || (isDatabase && endpoints.length === 0);

  return (
    <Row>
      {/* A public database has no host to key the placeholder on, but it still has an address */}
      {isAwaitingEndpoints &&
        (hosts.length > 0 ? hosts.map((h) => `${h.host}${h.path}${h.target_port}`) : [""]).map(
          (key) => (
            <ServiceUrl
              key={key}
              isPlaceholder={true}
              error={error?.message}
              className={hosts.length > 1 ? "max-w-1/2" : undefined}
            />
          ),
        )}
      {endpoints &&
        endpoints
          .filter((e) => e.target_port !== undefined)
          .map((e) => (
            <ServiceUrl
              key={`${e.host}${e.path}${e.target_port}`}
              endpoint={e}
              className={endpoints.length > 1 ? "max-w-1/2" : undefined}
            />
          ))}
    </Row>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="-mb-0.25 flex w-full flex-wrap px-2.75 pt-0.75 sm:px-6">{children}</div>;
}
