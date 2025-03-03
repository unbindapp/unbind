import ServiceIcon from "@/components/icons/service";
import TabIndicator from "@/components/navigation/tab-indicator";
import {
  servicePanelServiceIdKey,
  servicePanelTabKey,
} from "@/components/project/services/constants";
import Deployments from "@/components/project/services/tabs/deployments/deployments";
import Logs from "@/components/project/services/tabs/logs/logs";
import Metrics from "@/components/project/services/tabs/metrics/metrics";
import Settings from "@/components/project/services/tabs/settings/settings";
import Variables from "@/components/project/services/tabs/variables/variables";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { TService } from "@/server/trpc/api/main/router";
import { XIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { FC, ReactNode } from "react";

type TTab = {
  title: string;
  value: string;
  Page: FC<{ service: TService }>;
  noScrollArea?: boolean;
};

const tabs: TTab[] = [
  { title: "Deployments", value: "deployments", Page: Deployments },
  { title: "Variables", value: "variables", Page: Variables },
  { title: "Logs", value: "logs", Page: Logs, noScrollArea: true },
  { title: "Metrics", value: "metrics", Page: Metrics },
  { title: "Settings", value: "settings", Page: Settings },
];

type Props = {
  service: TService;
  children: ReactNode;
};

export default function ServicePanel({ service, children }: Props) {
  const [currentTab, setCurrentTab] = useQueryState(
    servicePanelTabKey,
    parseAsString.withDefault(tabs[0].value),
  );
  const currentPage = tabs.find((tab) => tab.value === currentTab);

  const [serviceId, setServiceId] = useQueryState(servicePanelServiceIdKey);

  const open = serviceId === service.id;
  const setOpen = (open: boolean) => {
    if (open) {
      setServiceId(service.id);
      return;
    }
    setServiceId(null);
    setCurrentTab(null);
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
        className="flex h-[calc(100%-3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-256 sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <div className="flex w-full items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
            <DrawerTitle className="flex min-w-0 flex-1 items-center justify-start gap-2.5">
              <ServiceIcon
                variant={service.type}
                color="brand"
                className="-ml-1 size-7 sm:size-8"
              />
              <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">
                {service.title}
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
        <nav className="flex w-full justify-start overflow-auto border-b">
          <div className="flex justify-start px-2 pt-3.5 sm:px-4.5">
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                variant="ghost"
                onClick={() => setCurrentTab(tab.value)}
                data-active={currentTab === tab.value ? true : undefined}
                className="group/button text-muted-foreground data-active:text-foreground min-w-0 shrink rounded-t-md rounded-b-none px-3 pt-2.5 pb-4.5 font-medium active:bg-transparent has-hover:hover:bg-transparent"
              >
                {tab.value === currentTab && <TabIndicator layoutId="service-panel-tab" />}
                <div className="pointer-events-none absolute h-full w-full py-1">
                  <div className="bg-border/0 has-hover:group-hover/button:bg-border group-active/button:bg-border h-full w-full rounded-lg" />
                </div>
                <p className="relative min-w-0 shrink leading-none">{tab.title}</p>
              </Button>
            ))}
          </div>
        </nav>
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <div className="flex min-h-0 w-full flex-1 flex-col">
            <ConditionalScrollArea noArea={currentPage?.noScrollArea}>
              {currentPage && <currentPage.Page service={service} />}
            </ConditionalScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ConditionalScrollArea({ noArea, children }: { noArea?: boolean; children?: ReactNode }) {
  if (noArea) return children;
  return <ScrollArea className="pb-[var(--safe-area-inset-bottom)]">{children}</ScrollArea>;
}
