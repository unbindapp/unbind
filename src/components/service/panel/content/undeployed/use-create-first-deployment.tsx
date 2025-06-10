import { useDeploymentsUtils } from "@/components/deployment/deployments-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useService } from "@/components/service/service-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { TToken } from "@/components/ui/textarea-with-tokens";
import { TReferenceExtended } from "@/components/variables/variables-form-field";
import { useVariablesUtils } from "@/components/variables/variables-provider";
import { api } from "@/server/trpc/setup/client";
import { useCallback, useMemo, useRef } from "react";

export default function useCreateFirstDeployment() {
  const {
    teamId,
    projectId,
    environmentId,
    serviceId,
    query: { refetch: refetchService },
  } = useService();

  const { refetch: refetchServices } = useServicesUtils({
    teamId,
    projectId,
    environmentId,
  });
  const { refetch: refetchDeployments } = useDeploymentsUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });
  const { refetch: refetchVariables } = useVariablesUtils({
    type: "service",
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  const { mutateAsync: createDeployment } = api.deployments.create.useMutation();
  const { mutateAsync: createOrUpdateVariables } = api.variables.createOrUpdate.useMutation();
  const { mutateAsync: updateService } = api.services.update.useMutation();

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const tokensRef = useRef<TToken<TReferenceExtended>[] | undefined>(undefined);
  const onTokensChanged = useCallback((tokens: TToken<TReferenceExtended>[] | undefined) => {
    tokensRef.current = tokens;
  }, []);

  const obj = useMemo(
    () => ({
      teamId,
      projectId,
      environmentId,
      serviceId,
      refetchService,
      refetchServices,
      refetchDeployments,
      refetchVariables,
      createDeployment,
      createOrUpdateVariables,
      updateService,
      temporarilyAddNewEntity,
      tokensRef,
      onTokensChanged,
    }),
    [
      teamId,
      projectId,
      environmentId,
      serviceId,
      refetchService,
      refetchServices,
      refetchDeployments,
      refetchVariables,
      createDeployment,
      createOrUpdateVariables,
      updateService,
      temporarilyAddNewEntity,
      tokensRef,
      onTokensChanged,
    ],
  );

  return obj;
}
