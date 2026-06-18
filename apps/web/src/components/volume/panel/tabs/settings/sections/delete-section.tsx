"use client";

import { useServices } from "@/components/service/services-provider";
import DeleteCard from "@/components/settings/delete-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { deleteVolume as deleteVolumeFn } from "@/lib/queries/storage";
import { TVolumeShallow } from "@/lib/queries/services";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function DeleteSection({ volume, className }: TProps) {
  const { teamId, projectId, environmentId } = useServices();
  const { closePanel } = useVolumePanel();

  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  const {
    mutateAsync: deleteVolume,
    error,
    reset,
  } = useMutation({
    mutationFn: deleteVolumeFn,
    onSuccess: () => {
      closePanel();
    },
  });

  if (volume.can_delete) {
    return (
      <SettingsSection
        entityId={sectionHighlightId}
        className="border-destructive/20"
        classNameHeader="text-destructive bg-destructive/8 border-destructive/15"
        title="Delete Volume"
        id="danger"
        Icon={Trash2Icon}
      >
        <DeleteCard
          dialogTitle="Delete Volume"
          dialogDescription="Are you sure you want to delete this volume? This action cannot be undone. All data inside the volume will be permanently deleted."
          paragraph="This action cannot be undone. All data inside the volume will be permanently deleted."
          buttonText="Delete Volume"
          error={error}
          deletingEntityName={volume.id}
          onDialogClose={reset}
          onSubmit={async () => {
            await deleteVolume({
              id: volume.id,
              type: "environment",
              teamId,
              projectId,
              environmentId,
            });
          }}
          className={cn("border-none p-0", className)}
        />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      entityId={sectionHighlightId}
      title="Delete Volume"
      id="danger"
      Icon={Trash2Icon}
    >
      <div className="flex w-full items-start justify-start">
        <p className="text-muted-foreground max-w-full px-1.5">
          This volume is attached to a service and{" "}
          <span className="text-foreground font-semibold">{"can't be deleted"}</span>.
        </p>
      </div>
    </SettingsSection>
  );
}

function getEntityId(volume: TVolumeShallow): string {
  return `danger-${volume.id}`;
}
