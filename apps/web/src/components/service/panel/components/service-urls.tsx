import ServiceUrl from "@/components/service/panel/components/service-url";
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import { TExternalEndpoint, THostFromServiceList } from "@/lib/queries/services";
import { useMemo } from "react";

type TProps = {
  hosts: THostFromServiceList[];
  className?: string;
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

export default function ServiceUrls({ hosts }: TProps) {
  const {
    query: { data, error },
  } = useServiceEndpoints();

  const endpoints = useMemo(() => collapseEndpoints(data?.endpoints.external), [data]);

  return (
    <div className="-mb-0.25 flex w-full flex-wrap px-2.75 pt-0.75 sm:px-6">
      {/* A database has no host to key the placeholder on, but it still has an address */}
      {!endpoints &&
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
    </div>
  );
}
