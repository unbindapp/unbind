import ErrorLine from "@/components/error-line";
import { useServicesUtils } from "@/components/project/services-provider";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import ServicePanelContent from "@/components/service/panel/content/service-panel-content";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import ServiceIcon from "@/components/service/service-icon";
import ServiceProvider, { useServiceUtils } from "@/components/service/service-provider";
import { DeleteEntityTrigger } from "@/components/settings/delete-card";
import { Button, LinkButton } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  serviceDescriptionMaxLength,
  ServiceDescriptionSchema,
  ServicenameSchema,
  serviceNameMaxLength,
  THost,
  TServiceShallow,
} from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import {
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  GlobeIcon,
  PenIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { ReactNode, useRef, useState } from "react";
import { z } from "zod";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { mutateAsync: updateService, error, reset } = api.services.update.useMutation();
  const { refetch: refetchService } = useServiceUtils({
    teamId,
    projectId,
    environmentId,
    serviceId: service.id,
  });
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });

  const form = useAppForm({
    defaultValues: {
      name: service.name,
      description: service.description,
    },
    validators: {
      onChange: z
        .object({
          name: ServicenameSchema,
          description: ServiceDescriptionSchema,
        })
        .strip(),
    },
    onSubmit: async ({ formApi, value }) => {
      if (value.name !== service.name || value.description !== service.description) {
        await updateService({
          teamId,
          projectId,
          environmentId,
          serviceId: service.id,
          name: value.name,
          description: value.description,
        });
        await Promise.all([refetchService(), refetchServices()]);
      }
      setIsDialogOpen(false);
      formApi.reset();
    },
  });

  const timeout = useRef<NodeJS.Timeout>(undefined);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            form.reset();
            reset();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-1.5 px-2.5 py-1"
        >
          <ServiceIcon service={service} color="brand" className="-ml-1 size-6 sm:size-7" />
          <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">
            {service.name}
          </p>
          <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100 sm:size-4.5" />
        </Button>
      </DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Rename Service</DialogTitle>
          <DialogDescription>Set a new name and description for the service.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex w-full flex-col gap-2"
        >
          <form.AppField
            name="name"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={service.name}
                layout="label-included"
                inputTitle="Service Name"
                maxLength={serviceNameMaxLength}
              />
            )}
          />
          <form.AppField
            name="description"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={service.description}
                layout="label-included"
                inputTitle="Service Description"
                maxLength={serviceDescriptionMaxLength}
              />
            )}
          />
          {error && <ErrorLine message={error.message} className="mt-2" />}
          <div className="mt-2 flex w-full flex-wrap items-center justify-end gap-2">
            <DialogClose asChild className="text-muted-foreground">
              <Button type="button" variant="ghost">
                Close
              </Button>
            </DialogClose>
            <form.Subscribe
              selector={(state) => [state.isSubmitting]}
              children={([isSubmitting]) => (
                <form.SubmitButton isPending={isSubmitting ? true : false}>Save</form.SubmitButton>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
              type="service"
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
              disableConfirmation
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <TrashIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteEntityTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ServiceUrl({ hostObject }: { hostObject: THost }) {
  return (
    <div className="-mb-0.25 flex w-full items-start justify-start px-2.75 pt-0.75 sm:px-6">
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
