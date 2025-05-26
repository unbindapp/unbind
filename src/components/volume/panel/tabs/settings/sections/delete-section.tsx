"use client";

import { useServices } from "@/components/project/services-provider";
import DeleteCard from "@/components/settings/delete-card";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function DeleteSection({ volume, className }: TProps) {
  const { teamId, projectId, environmentId } = useServices();
  const { closePanel } = useVolumePanel();

  const {
    mutateAsync: deleteVolume,
    error,
    reset,
  } = api.storage.volumes.delete.useMutation({
    onSuccess: () => {
      closePanel();
    },
  });

  if (volume.can_delete) {
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

  return (
    <div className="flex w-full items-start justify-start md:max-w-xl">
      <p className="text-muted-foreground max-w-full px-1.5">
        This volume is attached to a service and{" "}
        <span className="text-foreground font-semibold">{"can't be deleted"}</span>.
      </p>
    </div>
  );
}
