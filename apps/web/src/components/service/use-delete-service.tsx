import { useService } from "@/components/service/service-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useStagedChangesStore } from "@/components/staged-changes/staged-changes-provider";
import { useVolumesUtils } from "@/components/volume/volumes-provider";
import { deleteService } from "@/lib/queries/services";
import { deleteMutationKeys } from "@/lib/hooks/use-is-deleting";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

type TProps = {
  onSuccess?: () => void;
};

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

  const discardStaged = useStagedChangesStore((s) => s.discardReferencing);

  const { mutateAsync, isPending, error, reset } = useMutation({
    mutationKey: deleteMutationKeys.service(serviceId),
    mutationFn: deleteService,
    onSuccess: () => {
      discardStaged([serviceId]);
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
