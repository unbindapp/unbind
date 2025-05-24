"use client";

import DeleteCard from "@/components/settings/delete-card";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { useVolume, useVolumeUtils } from "@/components/volume/volume-provider";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";

type Props = {
  volume: TVolumeShallow;
  className?: string;
};

export default function DeleteSection({ volume, className }: Props) {
  const { teamId, projectId, environmentId } = useVolume();

  const { invalidate } = useVolumeUtils({
    id: volume.id,
    type: "environment",
    teamId,
    projectId,
    environmentId,
  });
  const { closePanel } = useVolumePanel();

  const {
    mutateAsync: deleteVolume,
    error,
    reset,
  } = api.storage.volumes.delete.useMutation({
    onSuccess: () => {
      closePanel();
      invalidate();
    },
  });

  return (
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
      className={className}
    />
  );
}
