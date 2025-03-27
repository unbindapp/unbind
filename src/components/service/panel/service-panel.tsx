import ServiceIcon from "@/components/icons/service";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import { servicePanelServiceIdKey, servicePanelTabKey } from "@/components/service/constants";
import ServicePanelContent, { tabs } from "@/components/service/panel/service-panel-content";
import ServiceProvider from "@/components/service/service-provider";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { THost, TServiceShallow } from "@/server/trpc/api/services/types";
import { ExternalLinkIcon, GlobeIcon, XIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
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
  const [, setCurrentTab] = useQueryState(
    servicePanelTabKey,
    parseAsString.withDefault(tabs[0].value),
  );

  const [serviceIdFromSearchParam, setServiceIdFromSearchParam] =
    useQueryState(servicePanelServiceIdKey);

  const open = serviceIdFromSearchParam === service.id;
  const setOpen = (open: boolean) => {
    if (open) {
      setServiceIdFromSearchParam(service.id);
      return;
    }
    setServiceIdFromSearchParam(null);
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
            <DrawerTitle className="flex min-w-0 shrink items-center justify-start gap-1.5">
              <ServiceIcon
                variant={service.config.framework || service.config.provider}
                color="brand"
                className="-ml-1 size-6 sm:size-7"
              />
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
        {service.config.hosts && service.config.hosts.length >= 1 && (
          <ServiceUrl hostObject={service.config.hosts[0]} />
        )}
        <ServiceProvider
          teamId={teamId}
          projectId={projectId}
          environmentId={environmentId}
          serviceId={service.id}
        >
          <ServicePanelContent service={service} />
        </ServiceProvider>
      </DrawerContent>
    </Drawer>
  );
}

function getUrlDisplayStr(hostObj: THost) {
  return hostObj.host + (hostObj.path === "/" ? "" : hostObj.path);
}

function getUrl(hostObj: THost) {
  return "https://" + hostObj.host + hostObj.path;
}

function ServiceUrl({ hostObject }: { hostObject: THost }) {
  return (
    <div className="-mb-0.5 flex w-full items-start justify-start px-2.75 pt-0.5 sm:px-6">
      <LinkButton
        className="text-muted-foreground group/button min-w-0 shrink px-2.25 py-1.25 text-left font-medium"
        variant="ghost"
        target="_blank"
        size="sm"
        href={getUrl(hostObject)}
        key={getUrl(hostObject)}
      >
        <div className="relative -ml-0.5 size-3.5 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45">
          <GlobeIcon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
          <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
        </div>
        <p className="min-w-0 shrink truncate">{getUrlDisplayStr(hostObject)}</p>
      </LinkButton>
    </div>
  );
}
