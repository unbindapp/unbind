"use client";

import { useDeviceSize } from "@/components/providers/device-size-provider";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import VolumePanelContent from "@/components/volume/panel/volume-panel-content";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import VolumeProvider from "@/components/volume/volume-provider";
import { TVolumeShallow } from "@/server/trpc/api/services/types";
import { HardDriveIcon, XIcon } from "lucide-react";
import { ReactNode } from "react";

type TProps = {
  volume: TVolumeShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
  children: ReactNode;
};

export default function VolumePanel({
  volume,
  teamId,
  projectId,
  environmentId,
  children,
}: TProps) {
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
    >
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent
        hasHandle={isExtraSmall}
        className="flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-256 sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <div className="flex w-full items-start justify-start px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
            <DrawerTitle className="sr-only">{volume.id}</DrawerTitle>
            <TitleButton volume={volume} />
          </DrawerHeader>
          <div className="-mt-2.25 -mr-3 flex items-center justify-end gap-1 sm:-mt-3 sm:-mr-5">
            {!isExtraSmall && (
              <DrawerClose asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-more-foreground shrink-0 rounded-lg"
                >
                  <XIcon className="size-5" />
                </Button>
              </DrawerClose>
            )}
          </div>
        </div>
        <VolumeProvider
          id={volume.id}
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
        >
          <VolumePanelContent
            volume={volume}
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
          />
        </VolumeProvider>
      </DrawerContent>
    </Drawer>
  );
}

function TitleButton({ volume }: { volume: TVolumeShallow }) {
  return (
    <Button
      variant="ghost"
      fadeOnDisabled={false}
      disabled
      className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-2 px-2.5 py-1"
    >
      <HardDriveIcon className="-ml-1 size-6 scale-85 sm:size-7" />
      <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">{volume.id}</p>
    </Button>
  );
}
