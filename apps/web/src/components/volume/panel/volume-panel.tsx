"use client";

import { useDeviceSize } from "@/components/providers/device-size-provider";
import { useServices, useServicesUtils } from "@/components/service/services-provider";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerHeaderButtonsWrapper,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { getVolumeDisplayName } from "@/components/volume/helpers";
import VolumePanelContent from "@/components/volume/panel/volume-panel-content";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { useVolumesUtils } from "@/components/volume/volumes-provider";
import { TVolumeShallow } from "@/lib/queries/services";
import {
  renameVolume as renameVolumeFn,
  volumeDescriptionMaxLength,
  volumeNameMaxLength,
  VolumeRenameSchema,
} from "@/lib/queries/storage";
import { useMutation } from "@tanstack/react-query";
import { HardDriveIcon, PenIcon, XIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { ReactNode } from "react";
import { toast } from "sonner";

type TProps = {
  volume: TVolumeShallow;
  children: ReactNode;
};

export default function VolumePanel({ volume, children }: TProps) {
  const { closePanel, currentVolumeId, setCurrentVolumeId } = useVolumePanel();

  const open = currentVolumeId === volume.id;
  const setOpen = (open: boolean) => {
    if (open) {
      setCurrentVolumeId(volume.id);
    } else {
      closePanel();
    }
  };
  const { isExtraSmall } = useDeviceSize();

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      direction={isExtraSmall ? "bottom" : "right"}
      handleOnly={!isExtraSmall}
      // Vaul's input repositioning is for the mobile keyboard. On desktop (right
      // direction) it fires on any visualViewport resize while an input is focused
      // and pins an inline pixel height that overrides `sm:h-full`, leaving the
      // drawer stuck at the wrong height. Only enable it on the mobile bottom drawer.
      repositionInputs={isExtraSmall}
    >
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent
        hasHandle={isExtraSmall}
        className="flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-5xl sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <div className="flex w-full items-start justify-start px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
            <DrawerTitle className="sr-only">{getVolumeDisplayName(volume)}</DrawerTitle>
            <TitleButton volume={volume} />
          </DrawerHeader>
          <DrawerHeaderButtonsWrapper>
            <DrawerClose asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-more-foreground shrink-0 rounded-lg"
              >
                <XIcon className="size-5" />
              </Button>
            </DrawerClose>
          </DrawerHeaderButtonsWrapper>
        </div>
        <VolumePanelContent volume={volume} />
      </DrawerContent>
    </Drawer>
  );
}

function TitleButton({ volume }: { volume: TVolumeShallow }) {
  const { teamId, projectId, environmentId } = useServices();
  const { mutateAsync: renameVolume, error, reset } = useMutation({ mutationFn: renameVolumeFn });
  const { refetch: refetchVolumes } = useVolumesUtils({ teamId, projectId, environmentId });
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });

  return (
    <RenameEntityTrigger
      type="name-and-description"
      dialogTitle="Rename Volume"
      dialogDescription="Give a new name and description to the volume."
      nameInputTitle="Volume Name"
      descriptionInputTitle="Volume Description"
      name={getVolumeDisplayName(volume)}
      description={volume.description || ""}
      nameMaxLength={volumeNameMaxLength}
      descriptionMaxLength={volumeDescriptionMaxLength}
      formSchema={VolumeRenameSchema}
      error={error}
      onDialogClose={() => reset()}
      onSubmit={async (value) => {
        await renameVolume({
          id: volume.id,
          type: volume.type,
          teamId,
          projectId,
          environmentId,
          name: value.name,
          description: value.description,
        });

        const refetchRes = await ResultAsync.fromPromise(
          Promise.all([refetchVolumes(), refetchServices()]),
          () => new Error("Failed to refetch volumes"),
        );

        if (refetchRes.isErr()) {
          console.error(refetchRes.error);
          toast.error("Failed to refetch volumes", {
            description: refetchRes.error.message,
          });
        }
      }}
    >
      <Button
        variant="ghost"
        className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-2 px-2.5 py-1"
      >
        <HardDriveIcon className="-ml-1 size-6 scale-85 sm:size-7" />
        <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">
          {getVolumeDisplayName(volume)}
        </p>
        <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100 sm:size-4.5" />
      </Button>
    </RenameEntityTrigger>
  );
}
