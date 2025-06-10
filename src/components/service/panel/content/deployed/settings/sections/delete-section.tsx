"use client";

import { useServicesUtils } from "@/components/service/services-provider";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import { useService } from "@/components/service/service-provider";
import DeleteCard from "@/components/settings/delete-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { Trash2Icon } from "lucide-react";

type Props = {
  service: TServiceShallow;
  className?: string;
};

export default function DeleteSection({ service, className }: Props) {
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
    <SettingsSection
      className="border-destructive/20"
      classNameHeader="text-destructive bg-destructive/8 border-destructive/15"
      title="Delete Service"
      id="danger"
      Icon={Trash2Icon}
    >
      <DeleteCard
        dialogTitle="Delete Service"
        dialogDescription="Are you sure you want to delete this service? This action cannot be undone. All data inside the service will be permanently deleted."
        paragraph="This action cannot be undone. All data inside the service will be permanently deleted."
        buttonText="Delete Service"
        error={error}
        deletingEntityName={service.name}
        onDialogClose={reset}
        onSubmit={async () => {
          await deleteService({ teamId, projectId, environmentId, serviceId: service.id });
        }}
        className={cn("border-none p-0", className)}
        classNameHeader="px-1"
      />
    </SettingsSection>
  );
}
