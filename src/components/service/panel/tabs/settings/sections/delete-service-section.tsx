"use client";

import { useServicesUtils } from "@/components/project/services-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useService } from "@/components/service/service-provider";
import DeleteCard from "@/components/settings/delete-card";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";

type Props = {
  service: TServiceShallow;
  className?: string;
};

export default function DeleteServiceSection({ service, className }: Props) {
  const { teamId, projectId, environmentId } = useService();

  const { invalidate } = useServicesUtils({ teamId, projectId, environmentId });
  const { closePanel } = useServicePanel();

  const {
    mutateAsync: deleteService,
    error,
    reset,
  } = api.services.delete.useMutation({
    onSuccess: () => {
      closePanel();
      invalidate();
    },
  });

  return (
    <DeleteCard
      type="service"
      error={error}
      deletingEntityName={service.name}
      onDialogClose={reset}
      onSubmit={async () => {
        await deleteService({ teamId, projectId, environmentId, serviceId: service.id });
      }}
      className={className}
    />
  );
}
