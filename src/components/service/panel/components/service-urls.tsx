import ServiceUrl from "@/components/service/panel/components/service-url";
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import { THostFromServiceList } from "@/server/trpc/api/services/types";

type TProps = {
  hosts: THostFromServiceList[];
  className?: string;
};

export default function ServiceUrls({ hosts }: TProps) {
  const {
    query: { data, error },
  } = useServiceEndpoints();

  const endpoints = data?.endpoints.external;

  return (
    <div className="-mb-0.25 flex w-full flex-wrap px-2.75 pt-0.75 sm:px-6">
      {!endpoints &&
        hosts.map((h) => (
          <ServiceUrl
            key={`${h.host}${h.path}${h.target_port}`}
            isPlaceholder={true}
            error={error?.message}
            className={hosts.length > 1 ? "max-w-1/2" : undefined}
          />
        ))}
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
