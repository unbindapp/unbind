"use client";

import { useDeviceSize } from "@/components/providers/device-size-provider";
import ServerPanelContent from "@/components/system/servers/panel/server-panel-content";
import { useServerPanel } from "@/components/system/servers/panel/server-panel-provider";
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
import { TServer } from "@/lib/queries/servers";
import { MonitorIcon, XIcon } from "lucide-react";
import { ReactElement } from "react";

type TProps = {
  server: TServer;
  children: ReactElement;
};

export default function ServerPanel({ server, children }: TProps) {
  const { closePanel, currentServerName } = useServerPanel();

  const open = currentServerName === server.name;
  const { isExtraSmall } = useDeviceSize();

  return (
    <Drawer
      open={open}
      // Opening is driven by the trigger link's navigation, only closing is handled here.
      onOpenChange={(newOpen) => {
        if (!newOpen) closePanel();
      }}
      direction={isExtraSmall ? "bottom" : "right"}
    >
      <DrawerTrigger nativeButton={false} render={children} />
      <DrawerContent
        hasHandle={isExtraSmall}
        className="flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-5xl sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <div className="flex w-full items-start justify-start px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
            <DrawerTitle className="flex min-w-0 shrink items-center justify-start gap-2">
              <MonitorIcon className="size-5 shrink-0 sm:size-6" />
              <p className="min-w-0 shrink text-left text-xl leading-tight font-semibold sm:text-2xl">
                {server.name}
              </p>
            </DrawerTitle>
          </DrawerHeader>
          <DrawerHeaderButtonsWrapper>
            <DrawerClose
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-more-foreground shrink-0 rounded-lg"
                >
                  <XIcon className="size-5" />
                </Button>
              }
            />
          </DrawerHeaderButtonsWrapper>
        </div>
        <ServerPanelContent server={server} />
      </DrawerContent>
    </Drawer>
  );
}
