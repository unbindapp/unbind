import { useService, useServiceUtils } from "@/components/service/service-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { TUpdateServiceInput } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { ResultAsync } from "neverthrow";
import { useCallback } from "react";
import { toast } from "sonner";

type TProps = {
  idToHighlight?: string;
  onSuccess?: () => void;
};

export default function useUpdateService({ onSuccess, idToHighlight }: TProps) {
  const { teamId, projectId, environmentId, serviceId } = useService();

  const { refetch: refetchServices } = useServiceUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  const { refetch: refetchService } = useServicesUtils({
    teamId,
    projectId,
    environmentId,
  });

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const { mutateAsync, isPending, error, reset } = api.services.update.useMutation({
    onMutate: async () => {},
    onSuccess: async () => {
      const result = await ResultAsync.fromPromise(
        Promise.all([refetchServices(), refetchService()]),
        () => new Error("Failed to refetch services"),
      );

      if (result.isErr()) {
        toast.error("Failed to refetch services", {
          description:
            "Update was successful, but failed to refetch services. Please refresh the page.",
        });
      }

      onSuccess?.();
      if (idToHighlight) {
        temporarilyAddNewEntity(idToHighlight);
      }
    },
  });

  const mutateAsyncWithInfo = useCallback(
    (props: TUpdateServiceInputSimple) =>
      mutateAsync({ ...props, teamId, projectId, environmentId, serviceId }),
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

export type TUpdateServiceInputSimple = Omit<
  TUpdateServiceInput,
  "teamId" | "projectId" | "environmentId" | "serviceId"
>;
