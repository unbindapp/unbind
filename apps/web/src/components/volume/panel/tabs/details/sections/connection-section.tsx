import { volumeSettingsIds } from "@/components/settings/settings-ids";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import ServiceIcon from "@/components/service/service-icon";
import {
  getDuplicateServiceNames,
  getServicePublicHost,
  ServicePickerItem,
  ServicePickerTriggerIcon,
} from "@/components/service/service-picker";
import { useServices, useServicesUtils } from "@/components/service/services-provider";
import { SettingsSection } from "@/components/settings/settings-section";
import { toast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { MountPathSchema } from "@/components/volume/mount-path";
import { useVolumePanel } from "@/components/volume/panel/volume-panel-provider";
import { useVolumesUtils } from "@/components/volume/volumes-provider";
import { TCommandItem } from "@/lib/hooks/use-app-form";
import {
  removeFormDraft,
  useAppFormWithPersistence,
} from "@/lib/hooks/use-app-form-with-persistence";
import { TVolumeShallow, updateService } from "@/lib/queries/services";
import { useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { BoxIcon, FolderClosedIcon, HardDriveIcon, UnplugIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useCallback, useEffect, useMemo } from "react";
import { z } from "zod";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

const AttachDraftSchema = z.object({ serviceId: z.string(), mountPath: z.string() });

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
  const attachableServices = useMemo(
    () => servicesData?.services.filter((service) => service.type !== "database"),
    [servicesData],
  );

  const serviceItems: TCommandItem[] | undefined = useMemo(
    () =>
      attachableServices?.map((service) => ({
        value: service.id,
        label: service.name,
        keywords: [service.name, getServicePublicHost(service) ?? ""],
      })),
    [attachableServices],
  );

  const ServiceItemElement = useCallback(
    ({ item, className }: { item: TCommandItem; className?: string }) => {
      const service = attachableServices?.find((s) => s.id === item.value);
      if (!service) return <p className={cn("min-w-0 leading-tight", className)}>{item.label}</p>;
      const duplicateNames = getDuplicateServiceNames(attachableServices ?? []);
      return (
        <ServicePickerItem
          service={service}
          showDescription={duplicateNames.has(service.name)}
          className={className}
        />
      );
    },
    [attachableServices],
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

  const persistenceKey = `volume-attach:${volume.id}`;

  const form = useAppFormWithPersistence({
    defaultValues: {
      serviceId: "",
      mountPath: volume.mount_path || "/data",
    },
    persistenceType: "session",
    persistenceKey,
    persistenceSchema: AttachDraftSchema,
    validators: {
      onChange: z
        .object({
          serviceId: z.string().min(1, "Select a service."),
          mountPath: MountPathSchema,
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
      removeFormDraft({ persistenceType: "session", persistenceKey });
    },
  });

  // A restored draft can point at a service that no longer exists
  const selectedServiceId = useStore(form.store, (s) => s.values.serviceId);
  useEffect(() => {
    if (!attachableServices || !selectedServiceId) return;
    if (attachableServices.some((service) => service.id === selectedServiceId)) return;
    form.setFieldValue("serviceId", "");
  }, [attachableServices, selectedServiceId, form]);

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
      <Block>
        <form.AppField
          name="serviceId"
          children={(field) => (
            <BlockItem id={volumeSettingsIds.connection.service} className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>Service</BlockItemTitle>
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
                  CommandEmptyIcon={BoxIcon}
                  CommandItemElement={ServiceItemElement}
                >
                  {({ isOpen }) => {
                    const selected = attachableServices?.find((s) => s.id === field.state.value);
                    return (
                      <BlockItemButtonLike
                        asElement="button"
                        text={selected?.name ?? "Select a service"}
                        Icon={({ className }) => (
                          <ServicePickerTriggerIcon service={selected} className={className} />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        isPending={isPendingServices}
                        disabled={isVolumeLocked(volume)}
                        hasChanges={!field.state.meta.isDefaultValue}
                      />
                    );
                  }}
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
            <BlockItem id={volumeSettingsIds.connection.mountPath} className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>Mount Path</BlockItemTitle>
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
                  disabled={isVolumeLocked(volume)}
                  hasChanges={!field.state.meta.isDefaultValue}
                />
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
      <VolumeIdBlock volume={volume} />
    </SettingsSection>
  );
}

function AttachedSection({ volume }: TProps) {
  const {
    query: { data: servicesData, isPending, error },
  } = useServices();

  const attachedService = servicesData?.services.find(
    (service) => service.id === volume.mounted_on_service_id,
  );

  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  return (
    <SettingsSection
      title="Connection"
      id="connection"
      entityId={sectionHighlightId}
      Icon={UnplugIcon}
    >
      <Block>
        <BlockItem id={volumeSettingsIds.connection.mountPath} className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle>Mount Path</BlockItemTitle>
            <BlockItemDescription>
              {isPending ? (
                <span className="bg-muted-foreground animate-skeleton rounded-md text-transparent">
                  Loading connection details...
                </span>
              ) : attachedService ? (
                <>
                  {volume.mount_status === "attaching" ? "Being attached to" : "Mounted on"}{" "}
                  <span className="text-foreground bg-foreground/2-10 border-foreground/2-10 inline-flex max-w-full items-center gap-1 rounded-md border px-1.25 align-bottom leading-tight font-semibold">
                    <ServiceIcon
                      service={attachedService}
                      color="brand"
                      className="size-3.5 shrink-0"
                    />
                    <span className="min-w-0 truncate">{attachedService.name}</span>
                  </span>{" "}
                  at this path.
                </>
              ) : error ? (
                "Something went wrong."
              ) : (
                "This volume is not attached to a service."
              )}
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
            <BlockItemButtonLike
              asElement="div"
              isPending={isPending}
              className={cn(isVolumeLocked(volume) && "opacity-50")}
              text={
                isPending
                  ? "Loading"
                  : !servicesData && error
                    ? "Error"
                    : volume.mount_path || "Not attached"
              }
              classNameText="whitespace-normal"
              Icon={({ className }: { className?: string }) => (
                <FolderClosedIcon className={className} />
              )}
            />
          </BlockItemContent>
        </BlockItem>
        {!servicesData && !isPending && error && <ErrorLine message={error.message} />}
      </Block>
      <VolumeIdBlock volume={volume} />
    </SettingsSection>
  );
}

// The display name is the service's, so this is the only place the name the volume
// actually has in the cluster shows up.
function VolumeIdBlock({ volume }: TProps) {
  const SuffixComponent = useCallback(
    ({ className }: { className?: string }) => (
      <div className={cn("-my-2.5 -mr-3 flex items-start justify-end self-stretch p-1", className)}>
        <CopyButton className="size-8" classNameIcon="size-4" valueToCopy={volume.id} />
      </div>
    ),
    [volume.id],
  );

  return (
    <Block>
      <BlockItem id={volumeSettingsIds.connection.volumeId} className="w-full md:w-full">
        <BlockItemHeader type="column">
          <BlockItemTitle>Volume ID</BlockItemTitle>
          <BlockItemDescription>Unbind uses this ID to identify the volume.</BlockItemDescription>
        </BlockItemHeader>
        <BlockItemContent>
          <BlockItemButtonLike
            asElement="div"
            text={volume.id}
            className={cn(isVolumeLocked(volume) && "opacity-50")}
            classNameText="whitespace-normal"
            Icon={({ className }: { className?: string }) => (
              <HardDriveIcon className={className} />
            )}
            SuffixComponent={SuffixComponent}
          />
        </BlockItemContent>
      </BlockItem>
    </Block>
  );
}

function isVolumeLocked(volume: TVolumeShallow): boolean {
  return volume.is_deleting || volume.mount_status === "detaching";
}

function getEntityId(volume: TVolumeShallow): string {
  return `connection_${volume.id}`;
}
