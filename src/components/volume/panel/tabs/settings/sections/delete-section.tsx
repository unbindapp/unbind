"use client";

import ErrorLine from "@/components/error-line";
import DeleteCard from "@/components/settings/delete-card";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { useVolume, useVolumeUtils } from "@/components/volume/volume-provider";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function DeleteSection({ volume, className }: TProps) {
  const {
    query: { data: volumeData, isPending: isPendingVolume, error: errorVolume },
  } = useVolume();

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

  if (volumeData && volumeData.volume.can_delete) {
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
    />;
  }

  if (isPendingVolume) {
    return (
      <div className="flex w-full items-start justify-start md:max-w-xl">
        <p className="animate-skeleton bg-muted-foreground max-w-full rounded-md px-1.5 leading-tight text-transparent">
          Loading volume details...
        </p>
      </div>
    );
  }

  if (!volumeData && !isPendingVolume && errorVolume) {
    return (
      <div className="flex w-full items-start justify-start md:max-w-xl">
        <ErrorLine message={errorVolume.message} />
      </div>
    );
  }

  return (
    <div className="flex w-full items-start justify-start">
      <p className="text-muted-foreground max-w-full px-1.5 leading-tight">
        This volume is attached to a service and{" "}
        <span className="text-foreground font-semibold">{"can't be deleted"}</span>.
      </p>
    </div>
  );
}
