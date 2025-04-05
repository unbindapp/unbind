import { useDeviceSize } from "@/components/providers/device-size-provider";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { ReactNode } from "react";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import ServiceIcon from "@/components/service/service-icon";

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  service: TServiceShallow;
  deployment: TDeploymentShallow;
  children: ReactNode;
};

export default function DeploymentPanel({ service, deployment, children }: TProps) {
  const { closePanel, currentDeploymentId, setCurrentDeploymentId } = useDeploymentPanel();

  const open = currentDeploymentId === deployment.id;
  const setOpen = (open: boolean) => {
    if (open) {
      setCurrentDeploymentId(deployment.id);
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
        transparentOverlay
        hasHandle={isExtraSmall}
        className="flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-256 sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <div className="flex w-full items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
            <DrawerTitle className="flex min-w-0 shrink items-center justify-start gap-1.5">
              <ServiceIcon service={service} color="brand" className="-ml-1 size-6 sm:size-7" />
              <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">
                {service.display_name}
              </p>
            </DrawerTitle>
          </DrawerHeader>
          {!isExtraSmall && (
            <DrawerClose asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-more-foreground -mt-2.25 -mr-3 shrink-0 rounded-lg sm:-mt-3 sm:-mr-5"
              >
                <XIcon className="size-5" />
              </Button>
            </DrawerClose>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
