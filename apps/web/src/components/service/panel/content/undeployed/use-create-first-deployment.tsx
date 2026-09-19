import { useDeploymentsUtils } from "@/components/deployment/deployments-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useService } from "@/components/service/service-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import type { TReferenceExtended, TVariableToken } from "@/components/variables/tokens";
import { useVariablesUtils } from "@/components/variables/variables-provider";
import { deployMutationKeys, useSharedMutation } from "@/lib/hooks/use-shared-mutation";
import { createDeployment as createDeploymentFn } from "@/lib/queries/deployments";
import { updateService as updateServiceFn } from "@/lib/queries/services";
import { createOrUpdateVariables as createOrUpdateVariablesFn } from "@/lib/queries/variables";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";

// Deploying runs three calls in a row. Naming the step keeps a failure from
// reading like the whole deploy is broken when only one part of it is.
function withStep<TArgs extends unknown[], TResult>(
  step: string,
  fn: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`${step}: ${reason}`, { cause: error });
    }
  };
}

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

  const { mutateAsync: createDeploymentMutation } = useMutation({
    mutationFn: createDeploymentFn,
  });
  const { mutateAsync: createOrUpdateVariablesMutation } = useMutation({
    mutationFn: createOrUpdateVariablesFn,
  });
  const { mutateAsync: updateServiceMutation } = useMutation({ mutationFn: updateServiceFn });

  const createDeployment = useMemo(
    () => withStep("Failed to start the deployment", createDeploymentMutation),
    [createDeploymentMutation],
  );
  const createOrUpdateVariables = useMemo(
    () => withStep("Failed to save the variables", createOrUpdateVariablesMutation),
    [createOrUpdateVariablesMutation],
  );
  const updateService = useMemo(
    () => withStep("Failed to save the settings", updateServiceMutation),
    [updateServiceMutation],
  );

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const mutationKey = useMemo(() => deployMutationKeys.firstDeployment(serviceId), [serviceId]);
  const { isPending, error } = useSharedMutation(mutationKey);

  const tokensRef = useRef<TVariableToken<TReferenceExtended>[] | undefined>(undefined);
  const onTokensChanged = useCallback(
    (tokens: TVariableToken<TReferenceExtended>[] | undefined) => {
      tokensRef.current = tokens;
    },
    [],
  );

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
      mutationKey,
      isPending,
      error,
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
      mutationKey,
      isPending,
      error,
    ],
  );

  return obj;
}
