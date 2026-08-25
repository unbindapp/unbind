"use client";

import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import useDeleteService from "@/components/service/use-delete-service";
import DeleteCard from "@/components/settings/delete-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { type TServiceShallow } from "@/lib/queries/services";
import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";

type Props = {
  service: TServiceShallow;
  className?: string;
};

export default function DeleteSection({ service, className }: Props) {
  const { closePanel } = useServicePanel();

  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  const {
    mutateAsync: deleteService,
    error,
    reset,
  } = useDeleteService({ onSuccess: closePanel });

  return (
    <SettingsSection
      entityId={sectionHighlightId}
      id="danger"
      className="border-destructive/20"
      classNameHeader="text-destructive bg-destructive/8 border-destructive/15"
      title="Delete Service"
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
          await deleteService();
        }}
        className={cn("border-none p-0", className)}
        classNameHeader="px-1"
      />
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `danger_${service.id}`;
}
