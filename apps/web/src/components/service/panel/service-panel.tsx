import { useDeviceSize } from "@/components/providers/device-size-provider";
import ServiceUrls from "@/components/service/panel/components/service-urls";
import ThreeDotButton from "@/components/service/panel/components/three-dot-button";
import TitleButton from "@/components/service/panel/components/title-button";
import ServicePanelContent from "@/components/service/panel/content/service-panel-content";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import ServiceEndpointsProvider from "@/components/service/service-endpoints-provider";
import ServiceProvider from "@/components/service/service-provider";
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
import { TServiceShallow } from "@/lib/queries/services";
import { XIcon } from "lucide-react";
import { ReactElement } from "react";

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  service: TServiceShallow;
  children: ReactElement;
};

export default function ServicePanel({
  teamId,
  projectId,
  environmentId,
  service,
  children,
}: TProps) {
  const { closePanel, currentServiceId, isTerminalFullscreen } = useServicePanel();

  const open = currentServiceId === service.id;
  const { isExtraSmall } = useDeviceSize();

  return (
    <Drawer
      open={open}
      onOpenChange={(newOpen, eventDetails) => {
        // Opening is driven by the trigger link's navigation, only closing is handled here.
        if (newOpen) return;
        // While the terminal is maximized, Esc exits fullscreen (handled in the
        // terminal) instead of closing the drawer.
        if (eventDetails.reason === "escape-key" && isTerminalFullscreen) {
          eventDetails.cancel();
          return;
        }
        closePanel();
      }}
      direction={isExtraSmall ? "bottom" : "right"}
    >
      <DrawerTrigger nativeButton={false} render={children} />
      <DrawerContent
        hasHandle={isExtraSmall}
        className="flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-5xl sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <ServiceProvider
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
          serviceId={service.id}
        >
          <div className="flex w-full items-start justify-start px-5 pt-4 sm:px-8 sm:pt-6">
            <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
              <DrawerTitle className="sr-only">{service.name}</DrawerTitle>
              <TitleButton
                service={service}
                teamId={teamId}
                projectId={projectId}
                environmentId={environmentId}
              />
            </DrawerHeader>
            <DrawerHeaderButtonsWrapper>
              {!service.last_deployment && (
                <ThreeDotButton service={service} className="rounded-lg" />
              )}
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
          <ServiceEndpointsProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={service.id}
          >
            {service.config.is_public &&
              service.config.hosts &&
              service.config.hosts.length >= 1 && <ServiceUrls hosts={service.config.hosts} />}
            {/* Content */}
            <ServicePanelContent service={service} />
          </ServiceEndpointsProvider>
        </ServiceProvider>
      </DrawerContent>
    </Drawer>
  );
}
