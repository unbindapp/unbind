import DeploymentProvider from "@/components/deployment/deployment-provider";
import { TDeploymentPanelTabEnum } from "@/components/deployment/panel/constants";
import { DeploymentPanelContent } from "@/components/deployment/panel/deployment-panel-content";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import Info from "@/components/deployment/panel/tabs/info/info";
import Logs from "@/components/deployment/panel/tabs/logs/logs";
import BroomIcon from "@/components/icons/broom";
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
import { CircleCheckIcon, LoaderIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { FC, ReactNode, useMemo } from "react";

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
};

export default function DeploymentPanel({ service }: TProps) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const {
    closePanel,
    currentTabId,
    currentDeployment,
    currentDeploymentId,
    currentDeploymentOfService,
  } = useDeploymentPanel();

  const currentTab = tabs.find((tab) => tab.value === currentTabId);

  const open = currentDeploymentId !== null;
  const onOpenChange = (open: boolean) => {
    if (!open) {
      closePanel();
    }
  };
  const { isExtraSmall } = useDeviceSize();

  const status = currentDeployment?.status;
  const id = currentDeployment?.id;

  const Icon = useMemo(() => {
    if (!status) return null;
    const sharedClassName = "size-4.5 sm:size-5 shrink-0";
    if (status === "building" || status === "queued")
      return <LoaderIcon className={`${sharedClassName} animate-spin`} />;
    if (
      status === "succeeded" &&
      currentDeploymentOfService &&
      id === currentDeploymentOfService.id
    )
      return <CircleCheckIcon className={`${sharedClassName}`} />;
    if (status === "failed") return <TriangleAlertIcon className={`${sharedClassName}`} />;
    return <BroomIcon className={`${sharedClassName}`} />;
  }, [status, id, currentDeploymentOfService]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isExtraSmall ? "bottom" : "right"}
      handleOnly={!isExtraSmall}
    >
      <DrawerContent
        transparentOverlay
        hasHandle={isExtraSmall}
        data-status={status}
        data-last-successful={currentDeploymentOfService?.id === id ? true : undefined}
        className="group/content flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-256 sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        {currentDeployment && (
          <DeploymentProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={serviceId}
            deploymentId={currentDeployment.id}
          >
            <div className="flex w-full items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
              <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
                <DrawerTitle className="flex w-full flex-col items-start justify-start gap-1.5">
                  <div className="text-muted-foreground flex w-full items-center gap-1.25 text-left text-sm font-medium sm:text-base">
                    <ServiceIcon
                      service={service}
                      color="monochrome"
                      className="-ml-0.25 size-4 sm:size-4.5"
                    />
                    <p className="min-w-0 shrink truncate leading-tight">{service.display_name}</p>
                  </div>
                  <p className="w-full min-w-0 text-left text-xl leading-tight font-semibold sm:text-2xl">
                    <span className="truncate">Deployment</span>{" "}
                    <span className="text-muted-more-foreground font-normal">/</span>{" "}
                    <span className="text-muted-foreground group-data-[status=failed]/content:text-destructive group-data-last-successful/content:group-data-[status=succeeded]/content:text-success group-data-[status=building]/content:text-process group-data-[status=queued]/content:text-process inline-flex min-w-0 shrink items-center justify-start gap-1.5">
                      {currentDeployment.id.slice(0, 6)}
                      {Icon}
                    </span>
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
            <DeploymentPanelContent
              deployment={currentDeployment}
              tabs={tabs}
              currentTab={currentTab}
            />
          </DeploymentProvider>
        )}
      </DrawerContent>
    </Drawer>
  );
}
