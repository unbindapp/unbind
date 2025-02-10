import ServiceIcon from "@/components/icons/service";
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
import { motion } from "motion/react";
import { parseAsString, useQueryState } from "nuqs";
import { FC, ReactNode } from "react";
import { useWindowSize } from "usehooks-ts";

type TTab = {
  title: string;
  value: string;
  Page: FC;
};

const tabs: TTab[] = [
  { title: "Deployments", value: "deployments", Page: Deployments },
  { title: "Variables", value: "variables", Page: Variables },
  { title: "Logs", value: "logs", Page: Logs },
  { title: "Metrics", value: "metrics", Page: Metrics },
  { title: "Settings", value: "settings", Page: Settings },
];

type Props = {
  service: TService;
  children: ReactNode;
};

export default function ServicePanel({ service, children }: Props) {
  const [currentTab, setCurrentTab] = useQueryState(
    "tab",
    parseAsString.withDefault(tabs[0].value)
  );
  const CurrentPage = tabs.find((tab) => tab.value === currentTab)?.Page;
  const [serviceId, setServiceId] = useQueryState("service_id");
  const open = serviceId === service.id;
  const setOpen = (open: boolean) => {
    setServiceId(open ? service.id : null);
  };
  const { width } = useWindowSize();
  const isSmall = width < 640;

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      autoFocus={open}
      direction={isSmall ? "bottom" : "right"}
      handleOnly
    >
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent
        hideHandle
        className="h-[calc(100%-5rem)] w-full rounded-t-2xl flex flex-col
        sm:ml-auto sm:my-0 sm:top-0 sm:h-full sm:right-0 sm:w-232 sm:max-w-[calc(100%-5rem)] sm:rounded-none"
      >
        <div className="w-full flex items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex-1 min-w-0 flex items-center justify-start p-0">
            <DrawerTitle className="flex-1 min-w-0 flex items-center justify-start gap-2.5">
              <ServiceIcon
                variant={service.type}
                color="color"
                className="size-7 sm:size-8 -ml-1"
              />
              <p className="shrink min-w-0 leading-tight text-xl sm:text-2xl text-left">
                {service.title}
              </p>
            </DrawerTitle>
          </DrawerHeader>
          <DrawerClose asChild>
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-more-foreground rounded-lg shrink-0 -mr-2.5 -mt-1.75 sm:-mr-5 sm:-mt-3"
            >
              <XIcon className="size-5" />
            </Button>
          </DrawerClose>
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
                px-3 pt-2.5 pb-4.5 text-muted-foreground data-[active]:text-foreground not-touch:hover:bg-transparent active:bg-transparent"
              >
                <div className="absolute w-full h-full pointer-events-none py-1">
                  <div
                    className="w-full h-full rounded-lg bg-border/0 
                    not-touch:group-hover/button:bg-border group-active/button:bg-border"
                  />
                </div>
                {currentTab === tab.value && (
                  <motion.div
                    transition={{ duration: 0.15 }}
                    layoutId="indicator-service-drawer-tabs"
                    className="w-full h-2px absolute left-0 bottom-0 bg-foreground rounded-full"
                  />
                )}
                <p className="shrink min-w-0 relative leading-none">
                  {tab.title}
                </p>
              </Button>
            ))}
          </div>
        </nav>
        <div className="w-full flex flex-col min-h-0 flex-1">
          <div className="flex flex-col flex-1 min-h-0">
            <ScrollArea>{CurrentPage && <CurrentPage />}</ScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
