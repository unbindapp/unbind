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
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { useService } from "@/components/service/service-provider";
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
import { CylinderIcon, DatabaseBackupIcon, OctagonXIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

// The API clears the bucket when it gets the nil UUID
const noBucketId = "00000000-0000-0000-0000-000000000000";

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
  const { staged, stage } = useServiceChanges(service);

  const serverBucketId = service.config.s3_backup_bucket_id ?? noBucketId;
  const stagedBucketId = stagedString(staged.s3BackupBucketId, serverBucketId);

  const form = useAppForm({
    defaultValues: {
      s3BucketId: stagedBucketId === noBucketId ? "" : stagedBucketId,
    },
  });
  useResetFormOnStagedChange(form, staged, ["s3BackupBucketId"]);

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

  const stageBucket = (id: string) =>
    stage({
      field: "s3BackupBucketId",
      label: "Backup bucket",
      value: id === "" ? noBucketId : id,
      previous: serverBucketId,
      format: bucketName,
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
      hasChanges={staged.s3BackupBucketId !== undefined}
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
