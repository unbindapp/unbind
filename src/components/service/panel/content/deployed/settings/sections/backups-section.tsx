import {
  getSourceAndBucketLabelFromValue,
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
import { toast } from "sonner";

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
  const { teamId } = useService();
  const {
    query: { data: dataS3Sources, isPending: isPendingS3Sources, error: errorS3Sources },
  } = useS3Sources();

  const sourceAndBucketItems = useMemo(() => {
    const items: TCommandItem[] | undefined = dataS3Sources?.sources.flatMap((source) =>
      source.buckets.map((bucket) => {
        const value = `${source.name} / ${bucket.name}${sourceAndBucketSeparator}${source.name}${sourceAndBucketSeparator}${source.id}${sourceAndBucketSeparator}${bucket.name}`;
        const label = getSourceAndBucketLabelFromValue(value);
        return {
          value,
          label,
        };
      }),
    );
    return items;
  }, [dataS3Sources]);

  const form = useAppForm({
    defaultValues: {
      sourceAndBucket:
        service.config.s3_backup_source_id && service.config.s3_backup_bucket
          ? `${service.config.s3_backup_source_id}${sourceAndBucketSeparator}${service.config.s3_backup_bucket}`
          : "",
    },
    onSubmit: async () => {
      toast.success("Changes saved successfully.", {
        description: "This is fake",
        duration: 5000,
      });
    },
  });

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
        form.handleSubmit();
      }}
      asElement="form"
      title="Backups"
      id="backups"
      Icon={DatabaseBackupIcon}
      changeCount={changeCount}
      onClickResetChanges={() => form.reset()}
      classNameContent="gap-5"
      SubmitButton={form.SubmitButton}
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
                  commandEmptyText="No buckets found"
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
