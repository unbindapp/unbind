import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import {
  backupSchedulePresets,
  customScheduleValue,
  formatBackupSchedule,
  scheduleToPreset,
  validateBackupRetentionCount,
  validateCronExpression,
} from "@/components/service/backups/backup-config";
import {
  stagedNumber,
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { useService } from "@/components/service/service-provider";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { MiniSection } from "@/components/settings/mini-section";
import { SettingsSection } from "@/components/settings/settings-section";
import { TDatabaseSectionProps } from "@/components/settings/types";
import type { TServiceChangeField } from "@/components/staged-changes/types";
import {
  AddBackupBucketTrigger,
  S3BucketCommandItemElement,
  S3BucketLabel,
  TAddBackupBucketTriggerProps,
} from "@/components/storage/create-backup-bucket-trigger";
import S3BucketsProvider, { useS3Buckets } from "@/components/storage/s3-buckets-provider";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/components/ui/utils";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/lib/queries/services";
import { useStore } from "@tanstack/react-form";
import { CalendarClockIcon, CylinderIcon, DatabaseBackupIcon, OctagonXIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

// The API clears the bucket when it gets the nil UUID
const noBucketId = "00000000-0000-0000-0000-000000000000";

const scheduleItems: TCommandItem[] = [
  ...backupSchedulePresets,
  { value: customScheduleValue, label: "Custom" },
];

const backupFields: TServiceChangeField[] = [
  "s3BackupBucketId",
  "backupSchedule",
  "backupRetentionCount",
];

export default function BackupsSection({ service }: TProps) {
  const { teamId } = useService();

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorWithWrapper message="Database type or version is not found." />;
    }

    return (
      <S3BucketsProvider teamId={teamId}>
        <DatabaseSection
          type={service.database_type}
          version={service.database_version}
          service={service}
        />
      </S3BucketsProvider>
    );
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function DatabaseSection({ service }: TDatabaseSectionProps) {
  const {
    query: { data: dataS3Buckets, isPending: isPendingS3Buckets, error: errorS3Buckets },
  } = useS3Buckets();
  const { teamId } = useService();

  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);
  const { staged, stage, unstage } = useServiceChanges(service);

  const serverBucketId = service.config.s3_backup_bucket_id ?? noBucketId;
  const serverSchedule = service.config.backup_schedule;
  const serverRetention = service.config.backup_retention_count;
  const stagedBucketId = stagedString(staged.s3BackupBucketId, serverBucketId);
  const stagedSchedule = stagedString(staged.backupSchedule, serverSchedule);
  const stagedRetention = stagedNumber(staged.backupRetentionCount, serverRetention);

  const defaultValues = {
    s3BucketId: stagedBucketId === noBucketId ? "" : stagedBucketId,
    backupSchedulePreset: scheduleToPreset(stagedSchedule),
    backupScheduleCustom: stagedSchedule,
    backupRetentionCount: String(stagedRetention),
  };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, backupFields);

  const schedulePreset = useStore(form.store, (s) => s.values.backupSchedulePreset);
  const backupsEnabled = stagedBucketId !== noBucketId;

  const s3BucketItems = useMemo(() => {
    const items: TCommandItem[] | undefined = dataS3Buckets?.buckets.map((s3Bucket) => ({
      value: s3Bucket.id,
      label: s3Bucket.name,
      description: s3Bucket.bucket,
    }));
    return items;
  }, [dataS3Buckets]);

  const bucketName = useCallback(
    (id: string) => {
      if (id === noBucketId) return "Disabled";
      return dataS3Buckets?.buckets.find((bucket) => bucket.id === id)?.name ?? id;
    },
    [dataS3Buckets],
  );

  const stageBucket = (id: string) => {
    stage({
      field: "s3BackupBucketId",
      label: "Backup bucket",
      value: id === "" ? noBucketId : id,
      previous: serverBucketId,
      format: bucketName,
    });
    // Without a bucket the schedule and retention mean nothing
    if (id === "") unstage(["backupSchedule", "backupRetentionCount"]);
  };

  const stageSchedule = (cron: string) =>
    stage({
      field: "backupSchedule",
      label: "Backup schedule",
      value: cron,
      previous: serverSchedule,
      format: formatBackupSchedule,
    });

  const stageRetention = (value: string) =>
    stage({
      field: "backupRetentionCount",
      label: "Backup retention",
      value: Number(value),
      previous: serverRetention,
      format: (v) => `${v} backups`,
    });

  const hasNoBuckets = dataS3Buckets ? dataS3Buckets.buckets.length === 0 : false;

  const AddBackupBucketTriggerMemoized = useCallback(
    (props: Omit<TAddBackupBucketTriggerProps, "teamId">) => (
      <AddBackupBucketTrigger teamId={teamId} {...props} />
    ),
    [teamId],
  );

  return (
    <SettingsSection
      title="Backups"
      id="backups"
      Icon={DatabaseBackupIcon}
      classNameContent="gap-5"
      entityId={sectionHighlightId}
      hasChanges={backupFields.some((field) => staged[field] !== undefined)}
    >
      <Block>
        <form.AppField
          name="s3BucketId"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={staged.s3BackupBucketId !== undefined}>
                  Backup Bucket
                </BlockItemTitle>
                <BlockItemDescription>
                  S3-compatible bucket to store the database backups.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncAndSearchableSelect
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => {
                    field.handleChange(v);
                    stageBucket(v);
                  }}
                  items={s3BucketItems}
                  isPending={isPendingS3Buckets}
                  error={errorS3Buckets?.message}
                  commandInputPlaceholder="Search buckets..."
                  CommandEmptyText="No buckets found"
                  CommandEmptyIcon={CylinderIcon}
                  CommandItemElement={S3BucketCommandItemElement}
                  TriggerWrapper={hasNoBuckets ? AddBackupBucketTriggerMemoized : undefined}
                  CommandItemsPinned={({ setIsOpen, commandValue }) => {
                    if (commandValue === "" || hasNoBuckets) {
                      return null;
                    }
                    return (
                      <CommandItem
                        onSelect={() => {
                          field.handleChange("");
                          stageBucket("");
                          setIsOpen(false);
                        }}
                        className="group/item text-warning data-[selected=true]:bg-warning/4-10 data-[selected=true]:text-warning px-3 font-medium"
                      >
                        <OctagonXIcon className="size-4" />
                        <p className="min-w-0 shrink leading-tight">Disable backups</p>
                      </CommandItem>
                    );
                  }}
                >
                  {({ isOpen }) => {
                    const selected = dataS3Buckets?.buckets.find(
                      (s3Bucket) => s3Bucket.id === field.state.value,
                    );
                    return (
                      <BlockItemButtonLike
                        asElement="button"
                        text={
                          selected ? (
                            <S3BucketLabel name={selected.name} bucket={selected.bucket} />
                          ) : (
                            "Select a bucket"
                          )
                        }
                        Icon={({ className }) => (
                          <CylinderIcon className={cn(className, "size-4.5")} />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        isPending={isPendingS3Buckets}
                      />
                    );
                  }}
                </field.AsyncAndSearchableSelect>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
      {backupsEnabled && (
        <Block>
          <BlockItem className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle hasChanges={staged.backupSchedule !== undefined}>
                Backup Schedule
              </BlockItemTitle>
              <BlockItemDescription>How often the database is backed up.</BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent className="gap-0">
              <form.AppField
                name="backupSchedulePreset"
                children={(field) => (
                  <field.AsyncDropdownMenu
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => {
                      field.handleChange(v);
                      if (v === customScheduleValue) {
                        stageSchedule(form.getFieldValue("backupScheduleCustom"));
                        return;
                      }
                      form.setFieldValue("backupScheduleCustom", v);
                      stageSchedule(v);
                    }}
                    items={scheduleItems}
                    isPending={false}
                    error={undefined}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        data-custom={field.state.value === customScheduleValue || undefined}
                        className="data-custom:rounded-b-none data-custom:border-b-0"
                        text={scheduleLabel(field.state.value)}
                        Icon={({ className }) => (
                          <CalendarClockIcon className={cn(className, "size-4.5")} />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </field.AsyncDropdownMenu>
                )}
              />
              {schedulePreset === customScheduleValue && (
                <>
                  <div className="bg-border -mt-1 h-px w-full" />
                  <form.AppField
                    name="backupScheduleCustom"
                    validators={{
                      onChange: ({ value }) => validateCronExpression(value),
                    }}
                    children={(field) => (
                      <field.TextField
                        className="-mt-1"
                        classNameInput="rounded-t-none border-t-0 font-mono"
                        field={field}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          if (field.state.meta.errors.length > 0) return;
                          stageSchedule(e.target.value);
                        }}
                        placeholder="0 0 * * *"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                      />
                    )}
                  />
                </>
              )}
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      {backupsEnabled && (
        <Block>
          <BlockItem className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle hasChanges={staged.backupRetentionCount !== undefined}>
                Backup Retention
              </BlockItemTitle>
              <BlockItemDescription>
                How many backups to keep. Older backups are deleted.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <form.AppField
                name="backupRetentionCount"
                validators={{
                  onChange: ({ value }) => validateBackupRetentionCount(value),
                }}
                children={(field) => (
                  <MiniSection
                    unit="backups"
                    hasChanges={staged.backupRetentionCount !== undefined}
                  >
                    <field.TextField
                      field={field}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        if (field.state.meta.errors.length > 0) return;
                        stageRetention(e.target.value);
                      }}
                      placeholder="3"
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck="false"
                      inputMode="numeric"
                      className="min-w-0 flex-1"
                      classNameInput="rounded-r-none"
                    />
                  </MiniSection>
                )}
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </SettingsSection>
  );
}

function scheduleLabel(value: string) {
  return scheduleItems.find((item) => item.value === value)?.label ?? value;
}

function getEntityId(service: TServiceShallow): string {
  return `backups_${service.id}`;
}
