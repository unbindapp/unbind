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
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { XIcon } from "lucide-react";
import { ReactNode } from "react";

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  service: TServiceShallow;
  children: ReactNode;
};

export default function ServicePanel({
  teamId,
  projectId,
  environmentId,
  service,
  children,
}: TProps) {
  const { closePanel, currentServiceId, setCurrentServiceId } = useServicePanel();

  const open = currentServiceId === service.id;
  const setOpen = (open: boolean) => {
    if (open) {
      setCurrentServiceId(service.id);
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
            <div className="-mt-2.25 -mr-3 flex items-center justify-end gap-1 sm:-mt-3 sm:-mr-5">
              {!service.last_deployment && (
                <ThreeDotButton
                  service={service}
                  teamId={teamId}
                  projectId={projectId}
                  environmentId={environmentId}
                />
              )}
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
          {service.config.is_public && service.config.hosts && service.config.hosts.length >= 1 && (
            <ServiceEndpointsProvider
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              serviceId={service.id}
            >
              <ServiceUrls hosts={service.config.hosts} />
            </ServiceEndpointsProvider>
          )}
          {/* Content */}
          <ServicePanelContent service={service} />
        </ServiceProvider>
      </DrawerContent>
    </Drawer>
  );
}
