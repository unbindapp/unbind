import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import { useService } from "@/components/service/service-provider";
import useUpdateService, {
  TUpdateServiceInputSimple,
} from "@/components/service/use-update-service";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { TDatabaseSectionProps } from "@/components/settings/types";
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
import { CylinderIcon, DatabaseBackupIcon, OctagonXIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

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

  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  const {
    mutateAsync: updateService,
    isPending: isPendingUpdate,
    error: errorUpdate,
    reset: resetUpdate,
    teamId,
  } = useUpdateService({
    onSuccess: async () => {
      form.reset();
    },
    idToHighlight: sectionHighlightId,
  });

  const form = useAppForm({
    defaultValues: {
      s3BucketId: service.config.s3_backup_bucket_id ?? "",
    },
    onSubmit: async ({ formApi, value }) => {
      let hasChanged = false;
      const changes: TUpdateServiceInputSimple = {};

      if (formApi.getFieldMeta("s3BucketId")?.isDefaultValue === false) {
        changes.s3BackupBucketId =
          value.s3BucketId === "" ? "00000000-0000-0000-0000-000000000000" : value.s3BucketId;
        hasChanged = true;
      }

      if (hasChanged) {
        await updateService(changes);
      } else {
        form.reset();
      }
    },
  });

  const s3BucketItems = useMemo(() => {
    const items: TCommandItem[] | undefined = dataS3Buckets?.buckets.map((s3Bucket) => ({
      value: s3Bucket.id,
      label: s3Bucket.name,
      description: s3Bucket.bucket,
    }));
    return items;
  }, [dataS3Buckets]);

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.fieldMeta.s3BucketId?.isDefaultValue === false) count++;
    return count;
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
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit(e);
      }}
      asElement="form"
      title="Backups"
      id="backups"
      Icon={DatabaseBackupIcon}
      changeCount={changeCount}
      onClickResetChanges={() => {
        form.reset();
        resetUpdate();
      }}
      classNameContent="gap-5"
      SubmitButton={form.SubmitButton}
      isPending={isPendingUpdate}
      error={errorUpdate?.message}
      entityId={sectionHighlightId}
    >
      <Block>
        <form.AppField
          name="s3BucketId"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
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
                  onChange={(v) => field.handleChange(v)}
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
                          setIsOpen(false);
                        }}
                        className="group/item text-warning data-[selected=true]:bg-warning/10 data-[selected=true]:text-warning px-3 font-medium"
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
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `backups_${service.id}`;
}
