import { useServiceUtils } from "@/components/service/service-provider";
import { useServicesUtils } from "@/components/service/services-provider";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { api } from "@/server/trpc/setup/client";
import { ResultAsync } from "neverthrow";
import { toast } from "sonner";

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  idToHighlight?: string;
  onSuccess?: () => void;
};

export default function useUpdateService({
  teamId,
  projectId,
  environmentId,
  serviceId,
  onSuccess,
  idToHighlight,
}: TProps) {
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

  const { mutateAsync, isPending, error } = api.services.update.useMutation({
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

  return {
    mutateAsync,
    isPending,
    error,
  };
}
