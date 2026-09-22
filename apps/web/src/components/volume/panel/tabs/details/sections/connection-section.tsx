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
import { useServices } from "@/components/service/services-provider";
import { volumeSettingsIds } from "@/components/settings/settings-ids";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  useStagedChangesStore,
  useStagedVolumeAttach,
} from "@/components/staged-changes/staged-changes-provider";
import { cn } from "@/components/ui/utils";
import { getVolumeDisplayName } from "@/components/volume/helpers";
import { MountPathSchema } from "@/components/volume/mount-path";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TVolumeShallow } from "@/lib/queries/services";
import { BoxIcon, FolderClosedIcon, HardDriveIcon, UnplugIcon } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { z } from "zod";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function ConnectionSection({ volume }: TProps) {
  const staged = useStagedVolumeAttach(volume.id);
  const discard = useStagedChangesStore((s) => s.discard);
  const isMounted = !!volume.mounted_on_service_id;

  // The volume got mounted, by the deploy or by another session, so there is nothing left to attach
  const settledId = isMounted ? staged?.id : undefined;
  useEffect(() => {
    if (!settledId) return;
    discard([settledId]);
  }, [settledId, discard]);

  if (!isMounted) {
    return <AttachSection volume={volume} />;
  }
  return <AttachedSection volume={volume} />;
}

// The volume is dangling, so it can be attached to a service in this environment. The
// attach is staged as soon as both fields are valid and deploys with the other changes.
function AttachSection({ volume }: TProps) {
  const {
    query: { data: servicesData, isPending: isPendingServices, error: errorServices },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const staged = useStagedVolumeAttach(volume.id);
  const stageList = useStagedChangesStore((s) => s.stageList);
  const discard = useStagedChangesStore((s) => s.discard);
  const isLocked = isVolumeLocked(volume) || staged?.isApplying === true;

  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  // Volumes can't be attached to database services, the database operator
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

  const defaultValues = {
    serviceId: staged?.serviceId ?? "",
    mountPath: staged?.mountPath ?? (volume.mount_path || "/data"),
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: z
        .object({
          serviceId: z.string().min(1, "Select a service."),
          mountPath: MountPathSchema,
        })
        .strip(),
    },
  });

  // A discard has to bring the form back to the server state. Deselecting the
  // service keeps the typed path for the next service that gets picked.
  const stagedKey = `${defaultValues.serviceId}:${defaultValues.mountPath}`;
  useEffect(() => {
    if (form.state.values.serviceId === defaultValues.serviceId) return;
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagedKey]);

  // A staged attach can point at a service that no longer exists
  const stagedId = staged?.id;
  const isStagedServiceGone =
    staged !== undefined &&
    attachableServices !== undefined &&
    !attachableServices.some((service) => service.id === staged.serviceId);
  useEffect(() => {
    if (!isStagedServiceGone || !stagedId) return;
    discard([stagedId]);
  }, [isStagedServiceGone, stagedId, discard]);

  const stageAttach = ({ serviceId, mountPath }: typeof defaultValues) => {
    const service = attachableServices?.find((s) => s.id === serviceId);
    if (!service || !MountPathSchema.safeParse(mountPath).success) return;
    stageList({
      kind: "volume",
      teamId,
      projectId,
      environmentId,
      serviceId: service.id,
      serviceName: service.name,
      serviceIcon: service.config.icon,
      volumeId: volume.id,
      volumeName: getVolumeDisplayName(volume),
      mountPath,
    });
  };

  return (
    <SettingsSection
      title="Connection"
      id="connection"
      entityId={sectionHighlightId}
      Icon={UnplugIcon}
      hasChanges={staged !== undefined}
      isApplying={staged?.isApplying}
      onDiscard={() => staged && discard([staged.id])}
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
                  isDeselectable
                  field={field}
                  value={field.state.value}
                  onChange={(v) => {
                    field.handleChange(v);
                    if (v === "") {
                      if (staged) discard([staged.id]);
                      return;
                    }
                    stageAttach({ ...form.state.values, serviceId: v });
                  }}
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
                        Icon={({ className, hasChanges }) => (
                          <ServicePickerTriggerIcon
                            service={selected}
                            color={hasChanges ? "monochrome" : "brand"}
                            className={className}
                          />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        isPending={isPendingServices}
                        disabled={isLocked}
                        hasChanges={staged !== undefined}
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
                  field={field}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                    stageAttach(form.state.values);
                  }}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="/data"
                  className="w-full"
                  disabled={isLocked}
                  hasChanges={staged !== undefined}
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
                  <span className="text-foreground bg-input inline-flex max-w-full items-center gap-1 rounded border px-1.25 align-bottom leading-tight font-semibold">
                    <ServiceIcon
                      service={attachedService}
                      color="brand"
                      className="-ml-px size-3.5 shrink-0"
                    />
                    <span className="min-w-0 wrap-break-word">{attachedService.name}</span>
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
