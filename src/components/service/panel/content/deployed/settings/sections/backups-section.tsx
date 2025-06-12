import {
  getSourceAndBucketLabelFromValue,
  getSourceIdAndBucketNameFromValue,
  getValueFromSourceAndBucket,
  sourceAndBucketSeparator,
} from "@/components/service/helpers";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useService } from "@/components/service/service-provider";
import useUpdateService, {
  TUpdateServiceInputSimple,
} from "@/components/service/use-update-service";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { TDatabaseSectionProps } from "@/components/settings/types";
import {
  CreateBackupSourceTrigger,
  SourceAndBucketCommandItemElement,
  TCreateBackupSourceTriggerProps,
} from "@/components/storage/create-backup-source-trigger";
import S3SourcesProvider, { useS3Sources } from "@/components/storage/s3-sources-provider";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/components/ui/utils";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
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
      <S3SourcesProvider teamId={teamId}>
        <DatabaseSection
          type={service.database_type}
          version={service.database_version}
          service={service}
        />
      </S3SourcesProvider>
    );
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function DatabaseSection({ service }: TDatabaseSectionProps) {
  const {
    query: { data: dataS3Sources, isPending: isPendingS3Sources, error: errorS3Sources },
  } = useS3Sources();

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
      sourceAndBucket:
        service.config.s3_backup_source_id && service.config.s3_backup_bucket
          ? getValueFromSourceAndBucket(
              service.config.s3_backup_source_id,
              dataS3Sources?.sources.find(
                (source) => source.id === service.config.s3_backup_source_id,
              )?.name,
              service.config.s3_backup_bucket,
            )
          : "",
    },
    onSubmit: async ({ formApi, value }) => {
      let hasChanged = false;
      const changes: TUpdateServiceInputSimple = {};

      if (formApi.getFieldMeta("sourceAndBucket")?.isDefaultValue === false) {
        const { sourceId, bucketName } = getSourceIdAndBucketNameFromValue(value.sourceAndBucket);
        changes.s3BackupSourceId =
          sourceId === "" ? "00000000-0000-0000-0000-000000000000" : sourceId;
        changes.s3BackupBucket = bucketName;
        hasChanged = true;
      }

      if (hasChanged) {
        await updateService(changes);
      } else {
        form.reset();
      }
    },
  });

  const sourceAndBucketItems = useMemo(() => {
    const items: TCommandItem[] | undefined = dataS3Sources?.sources.flatMap((source) =>
      source.buckets.map((bucket) => {
        const value = getValueFromSourceAndBucket(source.id, source.name, bucket.name);
        const label = getSourceAndBucketLabelFromValue(value);
        return {
          value,
          label,
        };
      }),
    );
    return items;
  }, [dataS3Sources]);

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.fieldMeta.sourceAndBucket?.isDefaultValue === false) count++;
    return count;
  });

  const hasNoBuckets = useMemo(() => {
    return dataS3Sources && dataS3Sources.sources.flatMap((s) => s.buckets).length === 0
      ? true
      : false;
  }, [dataS3Sources]);

  const CreateBackupSourceTriggerMemoized = useCallback(
    (props: Omit<TCreateBackupSourceTriggerProps, "teamId">) => (
      <CreateBackupSourceTrigger teamId={teamId} {...props} />
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
          name="sourceAndBucket"
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
                <field.AsyncCommandDropdown
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v)}
                  items={sourceAndBucketItems}
                  isPending={isPendingS3Sources}
                  error={errorS3Sources?.message}
                  commandInputPlaceholder="Search buckets..."
                  CommandEmptyText="No buckets found"
                  CommandEmptyIcon={CylinderIcon}
                  CommandItemElement={SourceAndBucketCommandItemElement}
                  TriggerWrapper={hasNoBuckets ? CreateBackupSourceTriggerMemoized : undefined}
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
                    const label = getSourceAndBucketLabelFromValue(field.state.value);
                    return (
                      <BlockItemButtonLike
                        asElement="button"
                        text={
                          field.state.value !== "" ? (
                            <>
                              {label.split(sourceAndBucketSeparator)[0]}
                              <span className="text-muted-more-foreground px-[0.5ch]">/</span>
                              {label.split(sourceAndBucketSeparator)[1]}
                            </>
                          ) : (
                            "Select a bucket"
                          )
                        }
                        Icon={({ className }) => (
                          <CylinderIcon className={cn("scale-90", className)} />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        isPending={isPendingS3Sources}
                      />
                    );
                  }}
                </field.AsyncCommandDropdown>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `backups-${service.id}`;
}
