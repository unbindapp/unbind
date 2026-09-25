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
  useStagedVolumeChange,
} from "@/components/staged-changes/staged-changes-provider";
import { volumeChangeId } from "@/components/staged-changes/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { getVolumeDisplayName } from "@/components/volume/helpers";
import { getMountPathError, MountPathSchema } from "@/components/volume/mount-path";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TVolumeShallow } from "@/lib/queries/services";
import { AnyFieldApi, useStore } from "@tanstack/react-form";
import {
  BoxIcon,
  CheckIcon,
  EjectIcon,
  FolderClosedIcon,
  HourglassIcon,
  HardDriveIcon,
  RotateCcwIcon,
  UnplugIcon,
  XIcon,
} from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { z } from "zod";

type TProps = {
  volume: TVolumeShallow;
  className?: string;
};

export default function ConnectionSection({ volume }: TProps) {
  const {
    query: { data: servicesData },
  } = useServices();
  const attachedService = servicesData?.services.find(
    (service) => service.id === volume.mounted_on_service_id,
  );
  const staged = useStagedVolumeChange(volume.id);
  const discard = useStagedChangesStore((s) => s.discard);

  // A staged unmount is done once the volume is leaving the service, by the deploy or by another
  // session
  const settledUnmountId =
    staged?.mountPath === null &&
    (staged.serviceId !== volume.mounted_on_service_id || volume.mount_status === "detaching")
      ? staged.id
      : undefined;
  useEffect(() => {
    if (!settledUnmountId) return;
    discard([settledUnmountId]);
  }, [settledUnmountId, discard]);

  if (!volume.mounted_on_service_id) {
    return <AttachSection volume={volume} />;
  }
  // The claim keeps its database label after the database is gone, so what counts
  // is the service it is mounted on now
  if (attachedService?.type === "database") {
    return <DatabaseSection volume={volume} />;
  }
  return <AttachedSection volume={volume} />;
}

// The volume is dangling, so it can be attached to a service in this environment. Picking
// a service stages the attach with the current path, a confirmed path restages it.
function AttachSection({ volume }: TProps) {
  const {
    query: { data: servicesData, isPending: isPendingServices, error: errorServices },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const stagedChange = useStagedVolumeChange(volume.id);
  const staged = stagedChange?.mountPath === null ? undefined : stagedChange;
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

  const defaultMountPath = volume.mount_path || "/data";
  const defaultValues = {
    serviceId: staged?.serviceId ?? "",
    mountPath: staged?.mountPath ?? defaultMountPath,
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
  const selectedServiceId = useStore(form.store, (s) => s.values.serviceId);

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
                <BlockItemTitle>Mount to Service</BlockItemTitle>
                <BlockItemDescription>The service to mount it on.</BlockItemDescription>
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
      {selectedServiceId && (
        <Block>
          <form.AppField
            name="mountPath"
            children={(field) => (
              <BlockItem id={volumeSettingsIds.connection.mountPath} className="w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle>Mount Path</BlockItemTitle>
                  <BlockItemDescription>
                    {"The volume's folder in the service."}
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContent>
                  <MountPathField
                    field={field}
                    baseline={defaultValues.mountPath}
                    revertTo={defaultMountPath}
                    disabled={isLocked}
                    onConfirm={(mountPath) => stageAttach({ ...form.state.values, mountPath })}
                    onRevert={() => {
                      field.handleChange(defaultMountPath);
                      stageAttach({ ...form.state.values, mountPath: defaultMountPath });
                    }}
                  />
                </BlockItemContent>
              </BlockItem>
            )}
          />
        </Block>
      )}
      <VolumeIdBlock volume={volume} />
    </SettingsSection>
  );
}

// The volume is on a service, so it can move to another path or unmount. Both are staged
// and deploy with the other changes.
function AttachedSection({ volume }: TProps) {
  const {
    query: { data: servicesData },
    teamId,
    projectId,
    environmentId,
  } = useServices();
  const staged = useStagedVolumeChange(volume.id);
  const stageList = useStagedChangesStore((s) => s.stageList);
  const discard = useStagedChangesStore((s) => s.discard);
  const isLocked = isVolumeLocked(volume) || staged?.isApplying === true;
  const isUnmountStaged = staged?.mountPath === null;
  const isUnmounting = volume.mount_status === "detaching";

  const attachedService = servicesData?.services.find(
    (service) => service.id === volume.mounted_on_service_id,
  );
  const serverMountPath = volume.mount_path ?? "";

  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  // A staged attach is done once the volume is mounted, by the deploy or by another
  // session. A staged path change is done once the server has the path.
  const isSettled =
    staged !== undefined &&
    (staged.previousMountPath === undefined ||
      (staged.serviceId === volume.mounted_on_service_id && staged.mountPath === serverMountPath));
  const settledId = isSettled ? staged.id : undefined;
  useEffect(() => {
    if (!settledId) return;
    discard([settledId]);
  }, [settledId, discard]);

  const defaultValues = { mountPath: staged?.mountPath ?? serverMountPath };

  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: z.object({ mountPath: MountPathSchema }).strip(),
    },
  });

  // A discard has to bring the input back to the server path
  useEffect(() => {
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues.mountPath]);

  const stageMountPath = (mountPath: string) => {
    if (!attachedService || getMountPathError(mountPath)) return;
    if (mountPath === serverMountPath) {
      discard([volumeChangeId(volume.id)]);
      return;
    }
    stageList({
      kind: "volume",
      teamId,
      projectId,
      environmentId,
      serviceId: attachedService.id,
      serviceName: attachedService.name,
      serviceIcon: attachedService.config.icon,
      volumeId: volume.id,
      volumeName: getVolumeDisplayName(volume),
      mountPath,
      previousMountPath: serverMountPath,
    });
  };

  const stageUnmount = () => {
    if (!attachedService) return;
    stageList({
      kind: "volume",
      teamId,
      projectId,
      environmentId,
      serviceId: attachedService.id,
      serviceName: attachedService.name,
      serviceIcon: attachedService.config.icon,
      volumeId: volume.id,
      volumeName: getVolumeDisplayName(volume),
      mountPath: null,
      previousMountPath: serverMountPath,
    });
  };

  const unmountControl = (
    <div className="-my-2.5 -mr-3 flex items-start justify-end self-stretch p-0.5">
      {isUnmountStaged ? (
        <Button
          type="button"
          aria-label="Revert"
          variant="ghost-change"
          size="icon"
          forceMinSize="medium"
          disabled={isLocked}
          onClick={() => discard([volumeChangeId(volume.id)])}
          className="rounded-md"
        >
          <RotateCcwIcon className="size-4.5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          forceMinSize="medium"
          disabled={isLocked || !attachedService}
          onClick={stageUnmount}
          className="text-muted-foreground h-9 gap-1.5 rounded-md px-2.5 py-0 text-sm font-semibold"
        >
          <EjectIcon className="size-4 shrink-0" />
          <span className="min-w-0 shrink truncate">Unmount</span>
        </Button>
      )}
    </div>
  );

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
      <MountedOnBlock
        volume={volume}
        isUnmountStaged={isUnmountStaged}
        trailing={isUnmounting ? undefined : unmountControl}
      />
      <Block>
        <form.AppField
          name="mountPath"
          children={(field) => (
            <BlockItem id={volumeSettingsIds.connection.mountPath} className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>Mount Path</BlockItemTitle>
                <BlockItemDescription>{"The volume's folder in the service."}</BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <MountPathField
                  field={field}
                  baseline={defaultValues.mountPath}
                  revertTo={serverMountPath}
                  disabled={isLocked || !attachedService || isUnmountStaged}
                  disabledText={
                    isUnmountStaged
                      ? "The volume will unmount"
                      : isUnmounting
                        ? "The volume is unmounting"
                        : undefined
                  }
                  onConfirm={stageMountPath}
                  onRevert={() => discard([volumeChangeId(volume.id)])}
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

type TMountPathFieldProps = {
  field: AnyFieldApi;
  // What cancel goes back to: the staged path, or the one revert goes back to
  baseline: string;
  // The server's path for an attached volume, the default path for a dangling one
  revertTo: string;
  disabled: boolean;
  onConfirm: (mountPath: string) => void;
  onRevert: () => void;
  disabledText?: string;
};

// Typing is a draft: it gets a cancel and a confirm button, and only a confirmed path
// is staged. The field shows as changed only while the confirmed path differs from the
// one revert brings back.
function MountPathField({
  field,
  baseline,
  revertTo,
  disabled,
  onConfirm,
  onRevert,
  disabledText,
}: TMountPathFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const value: string = field.state.value;
  const isDraft = value !== baseline;
  const draftError = isDraft ? getMountPathError(value) : null;
  const isStaged = baseline !== revertTo;
  const showRevert = !disabled && !isDraft && isStaged;
  const showDraftButtons = !disabled && isDraft;
  const buttonVariant = isStaged ? "ghost-change" : "ghost";

  const cancel = () => {
    field.handleChange(baseline);
    inputRef.current?.focus();
  };
  const confirm = () => {
    if (draftError) return;
    onConfirm(value);
  };

  return (
    <div className="flex w-full flex-col">
      <div className="relative w-full">
        <Input
          ref={inputRef}
          value={disabled ? (disabledText ?? value) : value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (!isDraft) return;
            if (e.key === "Enter") {
              e.preventDefault();
              confirm();
              return;
            }
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }}
          placeholder="/data"
          aria-invalid={draftError !== null || undefined}
          className={cn("w-full", showDraftButtons && "pr-20", showRevert && "pr-11.5")}
          disabled={disabled}
          hasChanges={isStaged}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="pointer-events-none absolute top-0 right-0 flex h-full items-center justify-end overflow-hidden pr-0.75">
          <div
            data-visible={showDraftButtons || showRevert || undefined}
            className="flex translate-x-full items-center transition data-visible:translate-x-0"
          >
            {showDraftButtons ? (
              <>
                <Button
                  type="button"
                  aria-label="Cancel"
                  onClick={cancel}
                  variant={buttonVariant}
                  size="icon"
                  className="pointer-events-auto rounded-md"
                >
                  <XIcon className="size-4.5" strokeWidth={2.5} />
                </Button>
                <Button
                  type="button"
                  aria-label="Confirm"
                  disabled={draftError !== null}
                  onClick={confirm}
                  variant={buttonVariant}
                  size="icon"
                  className="pointer-events-auto rounded-md"
                >
                  <CheckIcon className="size-4.5" strokeWidth={2.5} />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                aria-label="Revert"
                disabled={!showRevert}
                onClick={onRevert}
                variant={buttonVariant}
                data-staged={isStaged || undefined}
                size="icon"
                className="pointer-events-auto rounded-md"
              >
                <RotateCcwIcon className="size-4.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {draftError && <ErrorLine className="bg-transparent py-1.5 pl-1.5" message={draftError} />}
    </div>
  );
}

// A database mounts its volume where its engine expects it, so the path can't change
function DatabaseSection({ volume }: TProps) {
  const {
    query: { isPending },
  } = useServices();
  const sectionHighlightId = useMemo(() => getEntityId(volume), [volume]);

  return (
    <SettingsSection
      title="Connection"
      id="connection"
      entityId={sectionHighlightId}
      Icon={UnplugIcon}
    >
      <MountedOnBlock volume={volume} />
      <Block>
        <BlockItem id={volumeSettingsIds.connection.mountPath} className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle>Mount Path</BlockItemTitle>
            <BlockItemDescription>
              The volume's folder in the service. Fixed for databases.
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
            <BlockItemButtonLike
              asElement="div"
              isPending={isPending}
              className={cn(isVolumeLocked(volume) && "opacity-50")}
              text={isPending ? "Loading" : volume.mount_path || "Not mounted"}
              classNameText="whitespace-normal"
              Icon={({ className }: { className?: string }) => (
                <FolderClosedIcon className={className} />
              )}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
      <VolumeIdBlock volume={volume} />
    </SettingsSection>
  );
}

function MountedOnBlock({
  volume,
  isUnmountStaged = false,
  trailing,
}: TProps & { isUnmountStaged?: boolean; trailing?: ReactNode }) {
  const {
    query: { data: servicesData, isPending, error },
  } = useServices();
  const service = servicesData?.services.find((s) => s.id === volume.mounted_on_service_id);
  const isUnmounting = volume.mount_status === "detaching";

  return (
    <Block>
      <BlockItem id={volumeSettingsIds.connection.service} className="w-full md:w-full">
        <BlockItemHeader type="column">
          <BlockItemTitle>Mounted On</BlockItemTitle>
          <BlockItemDescription>The service this volume is mounted on.</BlockItemDescription>
        </BlockItemHeader>
        <BlockItemContent>
          <BlockItemButtonLike
            asElement="div"
            isPending={isPending}
            hasChanges={isUnmountStaged}
            className={cn(volume.is_deleting && "opacity-50")}
            text={
              isPending
                ? "Loading"
                : isUnmountStaged
                  ? "The volume will unmount"
                  : isUnmounting
                    ? "The volume is unmounting"
                    : (service?.name ?? "Service not found")
            }
            Icon={({ className }: { className?: string }) =>
              isUnmountStaged ? (
                <EjectIcon className={className} />
              ) : isUnmounting ? (
                <HourglassIcon className={cn("animate-hourglass", className)} />
              ) : (
                <ServicePickerTriggerIcon service={service} color="brand" className={className} />
              )
            }
            trailing={trailing}
          />
        </BlockItemContent>
      </BlockItem>
      {!servicesData && !isPending && error && <ErrorLine message={error.message} />}
    </Block>
  );
}

// The display name is the service's, so this is the only place the name the volume
// actually has in the cluster shows up.
function VolumeIdBlock({ volume }: TProps) {
  const SuffixComponent = useCallback(
    ({ className }: { className?: string }) => (
      <div
        className={cn("-my-2.5 -mr-3 flex items-start justify-end self-stretch p-0.5", className)}
      >
        <CopyButton classNameIcon="size-4" valueToCopy={volume.id} />
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
