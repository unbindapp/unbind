import DeploymentProvider from "@/components/deployment/deployment-provider";
import DeploymentStatusChip, {
  getDeploymentStatusChipColor,
} from "@/components/deployment/deployment-status-chip";
import { TDeploymentPanelTabEnum } from "@/components/deployment/panel/constants";
import {
  DeploymentPanelContent,
  DeploymentPanelContentPlaceholder,
} from "@/components/deployment/panel/deployment-panel-content";
import { useDeploymentPanel } from "@/components/deployment/panel/deployment-panel-provider";
import BuildLogs from "@/components/deployment/panel/tabs/build-logs/build-logs";
import DeployLogs from "@/components/deployment/panel/tabs/deploy-logs/deploy-logs";
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
  DrawerHeaderButtonsWrapper,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { getDurationStr } from "@/lib/hooks/use-time-difference";
import { TDeploymentShallow } from "@/lib/queries/deployments";
import { TServiceShallow } from "@/lib/queries/services";
import { RocketIcon, XIcon } from "lucide-react";
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

type TProps = {
  service: TServiceShallow;
};

export default function DeploymentPanel({ service }: TProps) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const {
    closePanel,
    currentTabId,
    currentDeployment: currentDeploymentInPanel,
    currentDeploymentId: currentDeploymentIdInPanel,
    isPending,
  } = useDeploymentPanel();

  const tabs = useMemo(() => {
    const tabs: TDeploymentPanelTab[] = [
      {
        title: "Deploy Logs",
        value: "deploy-logs",
        Page: DeployLogs,
        Provider: EmptyProvider,
        noScrollArea: true,
      },
      {
        title: "Build Logs",
        value: "build-logs",
        Page: BuildLogs,
        Provider: EmptyProvider,
        noScrollArea: true,
      },
    ];
    return tabs;
  }, []);

  const currentTab = tabs.find((tab) => tab.value === currentTabId);

  const open = currentDeploymentIdInPanel !== null;

  // The drawer opens as soon as the URL points at a deployment, which on a fresh
  // deep-link reload happens before the deployments list has loaded. Until it
  // does we can't resolve the deployment, so show a skeleton instead of the
  // "Deployment not found" state, which should only appear once we know it's missing.
  const isLoading = open && !currentDeploymentInPanel && isPending;

  const onOpenChange = (open: boolean) => {
    if (!open) {
      closePanel();
    }
  };
  const { isExtraSmall } = useDeviceSize();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isExtraSmall ? "bottom" : "right"}
      handleOnly={!isExtraSmall}
      // Vaul's input repositioning is for the mobile keyboard. On desktop (right
      // direction) it fires on any visualViewport resize while an input is focused
      // and pins an inline pixel height that overrides `sm:h-full`, leaving the
      // drawer stuck at the wrong height. Only enable it on the mobile bottom drawer.
      repositionInputs={isExtraSmall}
    >
      <DrawerContent
        transparentOverlay
        hasHandle={isExtraSmall}
        data-color={
          currentDeploymentInPanel
            ? getDeploymentStatusChipColor({
                deployment: currentDeploymentInPanel,
              })
            : "default"
        }
        className="group/content flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-5xl sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        {currentDeploymentInPanel ? (
          <DeploymentProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={serviceId}
            deploymentId={currentDeploymentInPanel.id}
          >
            <DeploymentPanelHeader service={service} deployment={currentDeploymentInPanel} />
            <DeploymentPanelContent
              deployment={currentDeploymentInPanel}
              tabs={tabs}
              currentTab={currentTab}
            />
          </DeploymentProvider>
        ) : isLoading ? (
          <>
            <DeploymentPanelHeader service={service} isPlaceholder={true} />
            <DeploymentPanelContentPlaceholder tabs={tabs} />
          </>
        ) : (
          <>
            <DeploymentPanelHeader service={service} bordered={true} />
            <ScrollArea>
              <TabWrapper>
                <NoItemsCard Icon={RocketIcon}>Deployment not found</NoItemsCard>
              </TabWrapper>
            </ScrollArea>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function DeploymentPanelHeader({
  service,
  deployment,
  isPlaceholder,
  bordered,
}: {
  service: TServiceShallow;
  deployment?: TDeploymentShallow;
  isPlaceholder?: boolean;
  // The not-found state has no navbar below it, so the header carries the separator itself.
  bordered?: boolean;
}) {
  const showProgress =
    deployment?.status === "build-queued" ||
    deployment?.status === "build-pending" ||
    deployment?.status === "build-running" ||
    deployment?.status === "build-succeeded" ||
    deployment?.status === "launching" ||
    deployment?.status === "launch-error";

  return (
    <div
      className={cn(
        "flex w-full items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6",
        bordered && "border-b pb-4 sm:pb-6",
      )}
    >
      <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
        <DrawerTitle className="flex w-full flex-col items-start justify-start gap-1.5">
          <div className="text-muted-foreground flex w-full items-center gap-1.25 text-left text-sm leading-tight font-medium sm:text-base">
            <ServiceIcon
              service={service}
              color="monochrome"
              className="-ml-px size-4 sm:size-4.5"
            />
            <p className="min-w-0 shrink truncate">
              {service.name} <span className="text-muted-more-foreground">/</span> Deployment
            </p>
          </div>
          <div
            data-placeholder={isPlaceholder || undefined}
            className="group/title text-foreground group-data-[color=destructive]/content:text-destructive group-data-[color=success]/content:text-success group-data-[color=process]/content:text-process group-data-[color=wait]/content:text-wait flex w-full items-center justify-start gap-1.5 text-left text-xl leading-tight font-semibold sm:text-2xl"
          >
            {deployment || isPlaceholder ? (
              <>
                <p className="group-data-placeholder/title:bg-muted-more-foreground group-data-placeholder/title:animate-skeleton min-w-0 shrink truncate rounded-md pr-1 group-data-placeholder/title:text-transparent">
                  {deployment ? deployment.id.slice(0, 6) : "000000"}
                </p>
                <DeploymentStatusChip
                  className="shrink-0 px-1.75 py-0.75 sm:text-base"
                  iconClassName="sm:size-4"
                  deployment={deployment}
                  isPlaceholder={isPlaceholder}
                />
                {showProgress && deployment && <DeploymentProgress deployment={deployment} />}
              </>
            ) : (
              <p className="min-w-0 shrink truncate pr-1">Unknown</p>
            )}
          </div>
        </DrawerTitle>
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
