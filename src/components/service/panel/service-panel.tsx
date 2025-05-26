import { useServicesUtils } from "@/components/project/services-provider";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import ServicePanelContent from "@/components/service/panel/content/service-panel-content";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import ServiceIcon from "@/components/service/service-icon";
import ServiceProvider, { useServiceUtils } from "@/components/service/service-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { ServiceRenameSchema, THost, TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  GlobeIcon,
  PenIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import { ReactNode, useState } from "react";
import { toast } from "sonner";

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
        {service.config.hosts && service.config.hosts.length >= 1 && (
          <ServiceUrls hosts={service.config.hosts} />
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

function TitleButton({
  service,
  teamId,
  projectId,
  environmentId,
}: {
  service: TServiceShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
}) {
  const { mutateAsync: updateService, error, reset } = api.services.update.useMutation();
  const { refetch: refetchService } = useServiceUtils({
    teamId,
    projectId,
    environmentId,
    serviceId: service.id,
  });
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });

  return (
    <RenameEntityTrigger
      type="name-and-description"
      dialogTitle="Rename Service"
      dialogDescription="Give a new name and description to the service."
      nameInputTitle="Service Name"
      descriptionInputTitle="Service Description"
      name={service.name}
      description={service.description}
      formSchema={ServiceRenameSchema}
      error={error}
      onDialogClose={() => reset()}
      onSubmit={async (value) => {
        await updateService({
          teamId,
          projectId,
          environmentId,
          serviceId: service.id,
          name: value.name,
          description: value.description,
        });

        const refetchRes = await ResultAsync.fromPromise(
          Promise.all([refetchService(), refetchServices()]),
          () => new Error("Failed to refetch services"),
        );

        if (refetchRes.isErr()) {
          console.error(refetchRes.error);
          toast.error("Failed to refetch services", {
            description: refetchRes.error.message,
          });
        }
      }}
    >
      <Button
        variant="ghost"
        className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-2 px-2.5 py-1"
      >
        <ServiceIcon service={service} color="brand" className="-ml-1 size-6 sm:size-7" />
        <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">{service.name}</p>
        <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100 sm:size-4.5" />
      </Button>
    </RenameEntityTrigger>
  );
}

function ThreeDotButton({
  service,
  teamId,
  projectId,
  environmentId,
  className,
}: {
  service: TServiceShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { closePanel } = useServicePanel();
  const { invalidate } = useServicesUtils({ teamId, projectId, environmentId });

  const {
    mutateAsync: deleteService,
    error,
    reset,
  } = api.services.delete.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      closePanel();
      invalidate();
    },
  });

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent",
            className,
          )}
        >
          <EllipsisVerticalIcon className="size-6 rotate-90 transition-transform group-data-open/button:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50 w-40"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <DeleteEntityTrigger
              dialogTitle="Delete Service"
              dialogDescription="Are you sure you want to delete this service? This action cannot be undone."
              onSubmit={async () => {
                await deleteService({
                  teamId,
                  projectId,
                  environmentId,
                  serviceId: service.id,
                });
              }}
              error={error}
              deletingEntityName={service.name}
              onDialogCloseImmediate={() => {
                setIsOpen(false);
              }}
              onDialogClose={() => {
                reset();
              }}
              disableConfirmationInput
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <Trash2Icon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteEntityTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ServiceUrls({ hosts }: { hosts: THost[] }) {
  return (
    <div className="-mb-0.25 flex w-full flex-wrap px-2.75 pt-0.75 sm:px-6">
      {hosts.map((h) => (
        <ServiceUrl
          key={`${h.host}${h.path}${h.port}`}
          hostObject={h}
          className={hosts.length > 1 ? "max-w-1/2" : undefined}
        />
      ))}
    </div>
  );
}

function ServiceUrl({ hostObject, className }: { hostObject: THost; className?: string }) {
  return (
    <div className={cn("flex max-w-full items-start justify-start sm:max-w-full", className)}>
      <LinkButton
        className="text-muted-foreground group/button min-w-0 shrink px-2.25 py-1 text-left font-medium"
        variant="ghost"
        target="_blank"
        size="sm"
        href={getUrl(hostObject)}
        key={getUrl(hostObject)}
      >
        <div className="relative -ml-0.5 size-3.5 shrink-0 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45">
          <GlobeIcon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
          <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
        </div>
        <p className="min-w-0 shrink truncate">{getUrlDisplayStr(hostObject)}</p>
      </LinkButton>
    </div>
  );
}

function getUrlDisplayStr(hostObj: THost) {
  return hostObj.host + (hostObj.path === "/" ? "" : hostObj.path);
}

function getUrl(hostObj: THost) {
  return "https://" + hostObj.host + hostObj.path;
}
