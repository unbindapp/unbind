import {
  getNetworkingDisplayUrl,
  getNetworkingEntityId,
} from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import { TModeAndPort } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/types";
import { useServiceEndpointsUtils } from "@/components/service/service-endpoints-provider";
import { useService } from "@/components/service/service-provider";
import useUpdateService from "@/components/service/use-update-service";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

export default function DeleteButton({
  domain,
  port,
  mode,
  disabled,
  service,
}: {
  domain: string;
  disabled?: boolean;
  service: TServiceShallow;
} & TModeAndPort) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { refetch: refetchEndpoints } = useServiceEndpointsUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  const sectionHighlightId = useMemo(() => getNetworkingEntityId(service), [service]);
  const { mutateAsync: updateService, refetch: refetchServices } = useUpdateService({
    idToHighlight: sectionHighlightId,
    manualRefetch: true,
  });

  const { mutateAsync: deleteDomainOrPort, error: errorDeleteDomainOrPort } = useMutation({
    mutationFn: async () => {
      if (mode === "public") {
        await updateService({
          removeHosts: [{ host: domain, path: "", target_port: port }],
        });
      } else if (mode === "private") {
        await updateService({
          removePorts: [{ port }],
        });
      }

      const result = await ResultAsync.fromPromise(
        Promise.all([refetchEndpoints(), refetchServices()]),
        () => new Error("Failed to refetch"),
      );

      if (result.isErr()) {
        toast.error("Failed to refetch", {
          description:
            "Update was successful, but failed to refetch service endpoints. Please refresh the page.",
        });
      }
    },
  });

  return (
    <DeleteEntityTrigger
      EntityNameBadge={() => (
        <p className="bg-foreground/6 border-foreground/6 -ml-0.5 max-w-[calc(100%+0.25rem)] rounded-md border px-1.5 font-mono font-semibold">
          {getNetworkingDisplayUrl({
            host: domain,
            port: mode === "public" ? "" : port.toString(),
          })}
        </p>
      )}
      deletingEntityName={domain}
      dialogTitle={mode === "private" ? "Delete Private Domain" : "Delete Domain"}
      dialogDescription={
        mode === "private"
          ? "The port will be deleted. All public domains using that port will be broken. This action cannot be undone."
          : "Are you sure you want to delete this domain? This action cannot be undone."
      }
      onSubmit={deleteDomainOrPort}
      error={errorDeleteDomainOrPort}
      disableConfirmationInput
    >
      <Button
        type="button"
        size="icon"
        variant="ghost-destructive"
        className="text-muted-more-foreground size-8 rounded-md"
        disabled={disabled}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </DeleteEntityTrigger>
  );
}
