import { useService } from "@/components/service/service-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useVolumesUtils } from "@/components/volume/volumes-provider";
import { deleteService } from "@/lib/queries/services";
import { Mutation, useMutation, useMutationState } from "@tanstack/react-query";
import { useCallback } from "react";

type TProps = {
  onSuccess?: () => void;
};

export const deleteServiceMutationKey = (serviceId: string) => ["delete-service", serviceId];
export const deleteServiceGroupMutationKey = (groupId: string) => ["delete-service-group", groupId];

// Stays true after success so the card keeps its deleting look until the refetch drops it
const isDeleteInFlight = (mutation: Mutation) =>
  mutation.state.status === "pending" || mutation.state.status === "success";

export function useIsServiceDeleting(serviceId: string | undefined) {
  const matches = useMutationState({
    filters: {
      mutationKey: deleteServiceMutationKey(serviceId ?? ""),
      exact: true,
      predicate: isDeleteInFlight,
    },
    select: (mutation) => mutation.state.status,
  });
  return serviceId !== undefined && matches.length > 0;
}

export function useIsServiceGroupDeleting(groupId: string | undefined) {
  const matches = useMutationState({
    filters: {
      mutationKey: deleteServiceGroupMutationKey(groupId ?? ""),
      exact: true,
      predicate: isDeleteInFlight,
    },
    select: (mutation) => mutation.state.status,
  });
  return groupId !== undefined && matches.length > 0;
}

export default function useDeleteService({ onSuccess }: TProps = {}) {
  const { teamId, projectId, environmentId, serviceId } = useService();

  const { invalidate: invalidateServices } = useServicesUtils({
    teamId,
    projectId,
    environmentId,
  });
  // Deleting a service leaves its volumes behind as dangling — refresh the
  // volumes list so they show up in the project's Volumes section right away.
  const { invalidate: invalidateVolumes } = useVolumesUtils({ teamId, projectId, environmentId });

  const { mutateAsync, isPending, error, reset } = useMutation({
    mutationKey: deleteServiceMutationKey(serviceId),
    mutationFn: deleteService,
    onSuccess: () => {
      onSuccess?.();
      invalidateServices();
      invalidateVolumes();
    },
  });

  const mutateAsyncWithInfo = useCallback(
    () => mutateAsync({ teamId, projectId, environmentId, serviceId }),
    [mutateAsync, teamId, projectId, environmentId, serviceId],
  );

  return {
    teamId,
    projectId,
    environmentId,
    serviceId,
    mutateAsync: mutateAsyncWithInfo,
    isPending,
    error,
    reset,
  };
}
