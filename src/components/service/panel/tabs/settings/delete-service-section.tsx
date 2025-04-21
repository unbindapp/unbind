"use client";

import { useServicesUtils } from "@/components/project/services-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useService } from "@/components/service/service-provider";
import DeleteCard from "@/components/settings/delete-card";
import { api } from "@/server/trpc/setup/client";

type Props = {
  className?: string;
};

export default function DeleteServiceSection({ className }: Props) {
  const {
    teamId,
    projectId,
    serviceId,
    environmentId,
    query: { data },
  } = useService();

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
      deletingEntityName={data?.service?.name}
      onDialogClose={reset}
      onSubmit={async () => {
        await deleteService({ teamId, projectId, environmentId, serviceId });
      }}
      className={className}
    />
  );
}
