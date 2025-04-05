import ErrorLine from "@/components/error-line";
import { useServicesUtils } from "@/components/project/services-provider";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import ServicePanelContent from "@/components/service/panel/service-panel-content";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import ServiceIcon from "@/components/service/service-icon";
import ServiceProvider, { useServiceUtils } from "@/components/service/service-provider";
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
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  serviceDescriptionMaxLength,
  ServiceDescriptionSchema,
  ServiceDisplayNameSchema,
  serviceNameMaxLength,
  THost,
  TServiceShallow,
} from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { ExternalLinkIcon, GlobeIcon, PenIcon, XIcon } from "lucide-react";
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
        <div className="flex w-full items-start justify-start gap-4 px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
            <DrawerTitle className="sr-only">{service.display_name}</DrawerTitle>
            <TitleButton
              service={service}
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
            />
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
      displayName: service.display_name,
      description: service.description,
    },
    validators: {
      onChange: z
        .object({
          displayName: ServiceDisplayNameSchema,
          description: ServiceDescriptionSchema,
        })
        .strip(),
    },
    onSubmit: async ({ formApi, value }) => {
      if (value.displayName !== service.display_name || value.description !== service.description) {
        await updateService({
          teamId,
          projectId,
          environmentId,
          serviceId: service.id,
          displayName: value.displayName,
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
          }, 200);
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
            {service.display_name}
          </p>
          <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-hover/button:rotate-0 group-hover/button:opacity-100 group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 sm:size-4.5" />
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
          className="mt-2 flex w-full flex-col gap-2"
        >
          <form.AppField
            name="displayName"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={service.display_name}
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
