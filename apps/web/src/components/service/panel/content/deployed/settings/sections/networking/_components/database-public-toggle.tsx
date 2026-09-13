import { getNetworkingEntityId } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import PublicPrivateToggle from "@/components/service/public-private-toggle";
import { useServiceEndpointsUtils } from "@/components/service/service-endpoints-provider";
import { useService } from "@/components/service/service-provider";
import useUpdateService from "@/components/service/use-update-service";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { toast } from "@/components/ui/toast";
import { TServiceShallow } from "@/lib/queries/services";
import { useMutation } from "@tanstack/react-query";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";

// Making a database private drops its public address and every UNBIND_*_PUBLIC key
// built on it, so anything referencing one is left holding a literal token
export default function DatabasePublicToggle({ service }: { service: TServiceShallow }) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { refetch: refetchEndpoints } = useServiceEndpointsUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  const sectionHighlightId = useMemo(() => getNetworkingEntityId(service.id), [service.id]);
  const { mutateAsync: updateService, refetch: refetchServices } = useUpdateService({
    idToHighlight: sectionHighlightId,
    manualRefetch: true,
  });

  const {
    mutateAsync: setPublic,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (isPublic: boolean) => {
      await updateService({ isPublic });
      const result = await ResultAsync.fromPromise(
        Promise.all([refetchEndpoints(), refetchServices()]),
        () => new Error("Failed to refetch"),
      );
      if (result.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to refetch",
          description: "Update was successful, but failed to refetch. Please refresh the page.",
        });
      }
    },
  });

  if (!service.config.is_public) {
    return (
      <PublicPrivateToggle isPublic={false} disabled={isPending} onChange={() => setPublic(true)} />
    );
  }

  return (
    <DeleteEntityTrigger
      variant="warning"
      dialogTitle="Make Database Private"
      dialogDescription="The database will only be reachable from inside the cluster. Services referencing its public address will stop resolving, and making it public again allocates a different port."
      deletingEntityName="the public address"
      submitButtonText="Make Private"
      disableConfirmationInput
      onSubmit={() => setPublic(false)}
      error={error}
    >
      <PublicPrivateToggle isPublic disabled={isPending} onChange={() => {}} />
    </DeleteEntityTrigger>
  );
}
