import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import ErrorLine from "@/components/error-line";
import { useServices, useServicesUtils } from "@/components/service/services-provider";
import { SettingsSection } from "@/components/settings/settings-section";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { useVolumesUtils } from "@/components/volume/volumes-provider";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { updateService, TVolumeShallow } from "@/lib/queries/services";
import { useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { FolderClosedIcon, ServerIcon, UnplugIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "@/components/ui/toast";
import { z } from "zod";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function ConnectionSection({ volume }: TProps) {
  if (!volume.mounted_on_service_id) {
    return <AttachSection volume={volume} />;
  }
  return <AttachedSection volume={volume} />;
}

// The volume is dangling — offer attaching it to a service in this environment.
function AttachSection({ volume }: TProps) {
  const {
    query: { data: servicesData, isPending: isPendingServices, error: errorServices },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const { invalidate: invalidateServices } = useServicesUtils({ teamId, projectId, environmentId });
  const { invalidate: invalidateVolumes } = useVolumesUtils({ teamId, projectId, environmentId });
  const { closePanel } = useVolumePanel();

  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  // Volumes can't be attached to database services — the database operator
  // manages its own storage.
  const serviceItems: TCommandItem[] | undefined = useMemo(
    () =>
      servicesData?.services
        .filter((service) => service.type !== "database")
        .map((service) => ({ value: service.id, label: service.name })),
    [servicesData],
  );

  const {
    mutateAsync: attachVolume,
    isPending: isPendingAttach,
    error: errorAttach,
  } = useMutation({
    mutationFn: updateService,
    onSuccess: async () => {
      const result = await ResultAsync.fromPromise(
        Promise.all([invalidateServices(), invalidateVolumes()]),
        () => new Error("Attach success callback failed"),
      );

      if (result.isErr()) {
        toast.add({
          type: "error",
          title: "Data refetch failed",
          description:
            "Attach was successful, but couldn't fetch the new data. Refresh the page to see the changes.",
        });
      }

      closePanel();
    },
  });

  const form = useAppForm({
    defaultValues: {
      serviceId: "",
      mountPath: volume.mount_path || "/data",
    },
    validators: {
      onChange: z
        .object({
          serviceId: z.string().min(1, "Select a service."),
          mountPath: z.string().startsWith("/", "Mount path must be an absolute path."),
        })
        .strip(),
    },
    onSubmit: async ({ value }) => {
      await attachVolume({
        teamId,
        projectId,
        environmentId,
        serviceId: value.serviceId,
        addVolumes: [{ id: volume.id, mount_path: value.mountPath }],
      });
    },
  });

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.fieldMeta.serviceId?.isDefaultValue === false) count++;
    if (s.fieldMeta.mountPath?.isDefaultValue === false) count++;
    return count;
  });

  return (
    <SettingsSection
      title="Connection"
      id="connection"
      entityId={sectionHighlightId}
      Icon={UnplugIcon}
      asElement="form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit(e);
      }}
      changeCount={changeCount}
      onClickResetChanges={() => form.reset()}
      SubmitButton={form.SubmitButton}
      isPending={isPendingAttach}
      error={errorAttach?.message}
    >
      <p className="text-muted-foreground w-full px-1.5">
        {volume.is_detaching
          ? "This volume is detaching from its previous service. It can be attached to a service once detaching is complete."
          : "This volume is not attached to a service. Attach it to a service in this environment to start using it."}
      </p>
      <Block>
        <form.AppField
          name="serviceId"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                  Service
                </BlockItemTitle>
                <BlockItemDescription>The service to attach this volume to.</BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncAndSearchableSelect
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  items={serviceItems}
                  isPending={isPendingServices}
                  error={errorServices?.message}
                  commandInputPlaceholder="Search services..."
                  CommandEmptyText="No services found"
                  CommandEmptyIcon={ServerIcon}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={
                        serviceItems?.find((item) => item.value === field.state.value)?.label ||
                        "Select a service"
                      }
                      Icon={({ className }) => <ServerIcon className={cn(className, "size-4.5")} />}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                      isPending={isPendingServices}
                      disabled={volume.is_deleting || volume.is_detaching}
                    />
                  )}
                </field.AsyncAndSearchableSelect>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
      <Block>
        <form.AppField
          name="mountPath"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                  Mount Path
                </BlockItemTitle>
                <BlockItemDescription>
                  The path to mount the volume at (e.g. /data).
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <field.TextField
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="/data"
                  className="w-full"
                  disabled={volume.is_deleting || volume.is_detaching}
                />
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
    </SettingsSection>
  );
}

function AttachedSection({ volume }: TProps) {
  const {
    query: { data: servicesData, isPending: isPendingServices, error: errorServices },
  } = useServices();

  const attachedService = servicesData
    ? servicesData.services.find((service) => service.id === volume.mounted_on_service_id)
    : undefined;

  const isPending = isPendingServices;
  const error = errorServices;
  const hasData = servicesData;

  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  return (
    <SettingsSection
      title="Connection"
      id="connection"
      entityId={sectionHighlightId}
      Icon={UnplugIcon}
    >
      <div
        data-pending={isPending || undefined}
        className="group/section flex w-full flex-col gap-2.5"
      >
        <p className="text-muted-foreground w-full px-1.5">
          {isPending ? (
            <span className="bg-muted-foreground animate-skeleton rounded-md text-transparent">
              Loading connection details...
            </span>
          ) : attachedService ? (
            <span>
              This volume is {volume.is_attaching ? "being attached to" : "attached to"}{" "}
              <span className="text-foreground bg-foreground/6 border-foreground/6 max-w-full rounded-md border px-1.25 leading-tight font-semibold">
                {attachedService.name}
              </span>{" "}
              on:
            </span>
          ) : error ? (
            <span>Something went wrong.</span>
          ) : (
            <span>This volume is not attached to a service.</span>
          )}
        </p>
        <div className="relative w-full">
          <FolderClosedIcon className="text-muted-foreground group-data-pending/section:animate-skeleton group-data-pending/section:bg-muted-foreground absolute top-1/2 left-3.25 z-1 size-5 -translate-y-1/2 group-data-pending/section:rounded-md" />
          <Input
            disabled
            fadeOnDisabled={false}
            value={
              isPending
                ? "Loading"
                : !hasData && error
                  ? "Error"
                  : volume.mount_path
                    ? volume.mount_path
                    : "Not attached"
            }
            className="relative pl-10.25 group-data-pending/section:opacity-0 disabled:cursor-text"
          />
          {isPending && (
            <div className="bg-input absolute top-0 left-0 flex h-full w-full items-center justify-start rounded-lg border pr-3 pl-10.25">
              <p className="bg-foreground animate-skeleton max-w-full min-w-0 truncate rounded-md leading-tight">
                Loading...
              </p>
            </div>
          )}
        </div>
        {!servicesData && !isPendingServices && errorServices && (
          <ErrorLine message={errorServices.message} />
        )}
      </div>
    </SettingsSection>
  );
}

function getEntityId(volume: TVolumeShallow): string {
  return `connection_${volume.id}`;
}
