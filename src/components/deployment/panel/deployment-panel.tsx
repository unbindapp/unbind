import DeploymentProvider from "@/components/deployment/deployment-provider";
import { TDeploymentPanelTabEnum } from "@/components/deployment/panel/constants";
import { DeploymentPanelContent } from "@/components/deployment/panel/deployment-panel-content";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import Info from "@/components/deployment/panel/tabs/info/info";
import Logs from "@/components/deployment/panel/tabs/logs/logs";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import ServiceIcon from "@/components/service/service-icon";
import { useService } from "@/components/service/service-provider";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { XIcon } from "lucide-react";
import { FC, ReactNode } from "react";

export type TDeploymentPanelTab = {
  title: string;
  value: TDeploymentPanelTabEnum;
  Page: TDeploymentPage;
  Provider: TDeploymentPageProvider;
  noScrollArea?: boolean;
};

type TDeploymentPage = FC<{ deployment: TDeploymentShallow }>;
type TDeploymentPageProvider = FC<TDeploymentPageProviderProps>;

type TDeploymentPageProviderProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  deploymentId: string;
  children: ReactNode;
};

const EmptyProvider = ({ children }: TDeploymentPageProviderProps) => children;

const tabs: TDeploymentPanelTab[] = [
  { title: "Info", value: "info", Page: Info, Provider: EmptyProvider },
  {
    title: "Build Logs",
    value: "build-logs",
    Page: Logs,
    Provider: EmptyProvider,
    noScrollArea: true,
  },
];

type TProps = {
  service: TServiceShallow;
  deployment: TDeploymentShallow;
};

export default function DeploymentPanel({ service, deployment }: TProps) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { closePanel, currentDeploymentId, setCurrentDeploymentId, currentTabId } =
    useDeploymentPanel();

  const currentTab = tabs.find((tab) => tab.value === currentTabId);

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
      <DrawerContent
        transparentOverlay
        hasHandle={isExtraSmall}
        className="flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-256 sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <DeploymentProvider
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
          serviceId={serviceId}
          deploymentId={deployment.id}
        >
          <div className="flex w-full items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
            <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
              <DrawerTitle className="flex min-w-0 shrink items-center justify-start gap-1.5">
                <ServiceIcon service={service} color="brand" className="-ml-1 size-6 sm:size-7" />
                <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">
                  {service.display_name}{" "}
                  <span className="text-muted-more-foreground font-normal">/</span> Deployment{" "}
                  <span className="text-muted-more-foreground font-normal">/</span>{" "}
                  {deployment.id.slice(0, 6)}
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
          <DeploymentPanelContent deployment={deployment} tabs={tabs} currentTab={currentTab} />
        </DeploymentProvider>
      </DrawerContent>
    </Drawer>
  );
}
