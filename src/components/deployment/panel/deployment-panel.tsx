import DeploymentProvider from "@/components/deployment/deployment-provider";
import { TDeploymentPanelTabEnum } from "@/components/deployment/panel/constants";
import { DeploymentPanelContent } from "@/components/deployment/panel/deployment-panel-content";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import BuildLogs from "@/components/deployment/panel/tabs/build-logs/build-logs";
import DeployLogs from "@/components/deployment/panel/tabs/deploy-logs/deploy-logs";
import DeploymentStatusChip, {
  getDeploymentStatusChipColor,
} from "@/components/deployment/deployment-status-chip";
import AnimatedTimerIcon from "@/components/icons/animated-timer";
import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import { useNow } from "@/components/providers/now-provider";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDurationStr } from "@/lib/hooks/use-time-difference";
import { TDeploymentShallow } from "@/server/trpc/api/deployments/types";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { RocketIcon, XIcon } from "lucide-react";
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
  {
    title: "Build Logs",
    value: "build-logs",
    Page: BuildLogs,
    Provider: EmptyProvider,
    noScrollArea: true,
  },
  {
    title: "Deploy Logs",
    value: "deploy-logs",
    Page: DeployLogs,
    Provider: EmptyProvider,
    noScrollArea: true,
  },
];

type TProps = {
  service: TServiceShallow;
};

export default function DeploymentPanel({ service }: TProps) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { closePanel, currentTabId, currentDeployment, currentDeploymentId } = useDeploymentPanel();

  const currentTab = tabs.find((tab) => tab.value === currentTabId);

  const open = currentDeploymentId !== null;

  const onOpenChange = (open: boolean) => {
    if (!open) {
      closePanel();
    }
  };
  const { isExtraSmall } = useDeviceSize();

  const showCurrentDeploymentProgress =
    currentDeployment?.status === "build-queued" ||
    currentDeployment?.status === "build-pending" ||
    currentDeployment?.status === "build-running" ||
    currentDeployment?.status === "build-succeeded" ||
    currentDeployment?.status === "launching" ||
    currentDeployment?.status === "launch-error";

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
        data-color={
          currentDeployment
            ? getDeploymentStatusChipColor({
                deployment: currentDeployment,
              })
            : "default"
        }
        className="group/content flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-256 sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        {!currentDeployment && (
          <>
            <div className="flex w-full items-start justify-start gap-4 border-b px-5 pt-4 pb-4 sm:px-8 sm:pt-6 sm:pb-6">
              <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
                <DrawerTitle className="flex w-full flex-col items-start justify-start gap-1.5">
                  <div className="text-muted-foreground flex w-full items-center gap-1.25 text-left text-sm leading-tight font-medium sm:text-base">
                    <ServiceIcon
                      service={service}
                      color="monochrome"
                      className="-ml-0.25 size-4 sm:size-4.5"
                    />
                    <p className="min-w-0 shrink truncate">
                      {service.name} <span className="text-muted-more-foreground">/</span>{" "}
                      Deployment
                    </p>
                  </div>
                  <div className="text-foreground group-data-[color=destructive]/content:text-destructive group-data-[color=success]/content:text-success group-data-[color=process]/content:text-process group-data-[color=wait]/content:text-wait flex w-full items-center justify-start gap-1.5 text-left text-xl leading-tight font-semibold sm:text-2xl">
                    <p className="min-w-0 shrink truncate pr-1">Unknown</p>
                  </div>
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
            <ScrollArea>
              <TabWrapper>
                <NoItemsCard Icon={RocketIcon}>Deployment not found</NoItemsCard>
              </TabWrapper>
            </ScrollArea>
          </>
        )}
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
                  <div className="text-muted-foreground flex w-full items-center gap-1.25 text-left text-sm leading-tight font-medium sm:text-base">
                    <ServiceIcon
                      service={service}
                      color="monochrome"
                      className="-ml-0.25 size-4 sm:size-4.5"
                    />
                    <p className="min-w-0 shrink truncate">
                      {service.name} <span className="text-muted-more-foreground">/</span>{" "}
                      Deployment
                    </p>
                  </div>
                  <div className="text-foreground group-data-[color=destructive]/content:text-destructive group-data-[color=success]/content:text-success group-data-[color=process]/content:text-process group-data-[color=wait]/content:text-wait flex w-full items-center justify-start gap-1.5 text-left text-xl leading-tight font-semibold sm:text-2xl">
                    <p className="min-w-0 shrink truncate pr-1">
                      {currentDeployment.id.slice(0, 6)}
                    </p>
                    <DeploymentStatusChip
                      className="shrink-0 px-1.75 py-0.75 sm:text-base"
                      iconClassName="sm:size-4"
                      deployment={currentDeployment}
                      isPlaceholder={false}
                    />
                    {showCurrentDeploymentProgress && (
                      <DeploymentProgress deployment={currentDeployment} />
                    )}
                  </div>
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

function DeploymentProgress({ deployment }: { deployment: TDeploymentShallow }) {
  const now = useNow();
  const durationStr = getDurationStr({
    end: now,
    start: new Date(deployment.created_at).getTime(),
  });
  return (
    <div className="text-foreground bg-border flex shrink-0 items-center justify-start gap-1.25 rounded-md px-2 py-0.75 font-mono text-sm font-medium sm:text-base">
      <AnimatedTimerIcon animate={true} className="-ml-0.75 size-3.5 sm:size-4" />
      <p className="min-w-0 shrink leading-tight">{durationStr}</p>
    </div>
  );
}
