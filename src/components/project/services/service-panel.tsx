import ServiceIcon from "@/components/icons/service";
import TabIndicator from "@/components/navigation/tab-indicator";
import {
  servicePanelServiceIdKey,
  servicePanelTabKey,
} from "@/components/project/services/constants";
import Deployments from "@/components/project/services/tabs/deployments/deployments";
import Logs from "@/components/project/services/tabs/logs";
import Metrics from "@/components/project/services/tabs/metrics";
import Settings from "@/components/project/services/tabs/settings";
import Variables from "@/components/project/services/tabs/variables/variables";
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
import { useWindowSize } from "usehooks-ts";

type TTab = {
  title: string;
  value: string;
  Page: FC;
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
    parseAsString.withDefault(tabs[0].value)
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
  const { width } = useWindowSize();
  const isSmall = width === undefined ? false : width < 640;

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      direction={isSmall ? "bottom" : "right"}
      handleOnly={!isSmall}
    >
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent
        hasHandle={isSmall}
        className="h-[calc(100%-3rem)] w-full flex flex-col
        sm:ml-auto sm:my-0 sm:top-0 sm:h-full sm:right-0 sm:w-232 sm:max-w-[calc(100%-4rem)] sm:rounded-r-none sm:rounded-l-2xl"
      >
        <div className="w-full flex items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex-1 min-w-0 flex items-center justify-start p-0">
            <DrawerTitle className="flex-1 min-w-0 flex items-center justify-start gap-2.5">
              <ServiceIcon
                variant={service.type}
                color="brand"
                className="size-7 sm:size-8 -ml-1"
              />
              <p className="shrink min-w-0 leading-tight text-xl sm:text-2xl text-left">
                {service.title}
              </p>
            </DrawerTitle>
          </DrawerHeader>
          {!isSmall && (
            <DrawerClose asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-more-foreground rounded-lg shrink-0 -mr-3 -mt-2.25 sm:-mr-5 sm:-mt-3"
              >
                <XIcon className="size-5" />
              </Button>
            </DrawerClose>
          )}
        </div>
        <nav className="w-full flex overflow-auto justify-start border-b">
          <div className="flex justify-start px-2 sm:px-4.5 pt-3.5">
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                variant="ghost"
                onClick={() => setCurrentTab(tab.value)}
                data-active={currentTab === tab.value ? true : undefined}
                className="shrink rounded-t-md rounded-b-none min-w-0 font-medium group/button
                  px-3 pt-2.5 pb-4.5 text-muted-foreground data-[active]:text-foreground has-hover:hover:bg-transparent active:bg-transparent"
              >
                {tab.value === currentTab && (
                  <TabIndicator layoutId="service-panel-tab" />
                )}
                <div className="absolute w-full h-full pointer-events-none py-1">
                  <div
                    className="w-full h-full rounded-lg bg-border/0 
                      has-hover:group-hover/button:bg-border group-active/button:bg-border"
                  />
                </div>
                <p className="shrink min-w-0 relative leading-none">
                  {tab.title}
                </p>
              </Button>
            ))}
          </div>
        </nav>
        <div className="w-full flex flex-col min-h-0 flex-1">
          <div className="w-full flex flex-col flex-1 min-h-0">
            <ConditionalScrollArea noArea={currentPage?.noScrollArea}>
              {currentPage && <currentPage.Page />}
            </ConditionalScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ConditionalScrollArea({
  noArea,
  children,
}: {
  noArea?: boolean;
  children?: ReactNode;
}) {
  if (noArea) return children;
  return (
    <ScrollArea className="pb-[var(--safe-area-inset-bottom)]">
      {children}
    </ScrollArea>
  );
}
