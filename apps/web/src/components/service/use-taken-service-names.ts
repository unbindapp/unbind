import { servicesListQuery } from "@/lib/queries/services";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// Groups only come with their services, so an empty group is left for the server to catch
export function useTakenServiceNames(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) {
  const { data } = useQuery({
    ...servicesListQuery(input),
    enabled: input.environmentId !== "",
  });

  return useMemo(() => {
    const services = data?.services ?? [];
    const groupNames = new Set<string>();
    for (const service of services) {
      if (service.service_group) groupNames.add(service.service_group.name);
    }
    return { serviceNames: services.map((s) => s.name), groupNames: Array.from(groupNames) };
  }, [data]);
}
