import { servicePanelServiceIdKey } from "@/components/service/panel/constants";
import { deploymentsListQuery } from "@/lib/queries/deployments";
import { replicaHealthQuery } from "@/lib/queries/replicas";
import { serviceEndpointsQuery, serviceQuery } from "@/lib/queries/services";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export type TServiceQueryInput = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
};

// Everything the service panel reads on open, so hovering a service warms it all
export function usePrefetchService() {
  const queryClient = useQueryClient();
  return useCallback(
    (input: TServiceQueryInput) => {
      void queryClient.prefetchQuery(deploymentsListQuery(input));
      void queryClient.prefetchQuery(serviceQuery(input));
      void queryClient.prefetchQuery(serviceEndpointsQuery(input));
      void queryClient.prefetchQuery(replicaHealthQuery(input));
    },
    [queryClient],
  );
}

export function getServiceLinkProps(input: TServiceQueryInput) {
  return {
    to: "/$team_id/project/$project_id",
    params: { team_id: input.teamId, project_id: input.projectId },
    search: { environment: input.environmentId, [servicePanelServiceIdKey]: input.serviceId },
  } as const;
}
