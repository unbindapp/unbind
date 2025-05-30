import { NewS3SourceTrigger } from "@/app/(team)/[team_id]/settings/storage/_components/s3-source-card";
import { databaseTypeToName } from "@/components/command-panel/context-command-panel/items/database";
import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import VariablesBlock from "@/components/service/panel/content/undeployed/blocks/variables-block";
import DeployButtonSection from "@/components/service/panel/content/undeployed/deploy-button-section";
import useCreateFirstDeployment from "@/components/service/panel/content/undeployed/use-create-first-deployment";
import { softValidateVariables } from "@/components/service/panel/content/undeployed/validators";
import { WrapperForm, WrapperInner } from "@/components/service/panel/content/undeployed/wrapper";
import { useService } from "@/components/service/service-provider";
import S3SourcesProvider, { useS3Sources } from "@/components/storage/s3-sources-provider";
import { CommandItem } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { getVariablesPair } from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TVariableForCreate } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { CylinderIcon, MilestoneIcon, OctagonXIcon, PlusIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { ReactNode, useCallback, useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  type: string;
  version: string;
};

export function UndeployedContentDatabase(props: TProps) {
  const { teamId } = useService();
  return (
    <S3SourcesProvider teamId={teamId}>
      <UndeployedContentDatabase_ {...props} />
    </S3SourcesProvider>
  );
}

const sourceAndBucketSeparator = "||||||";

function UndeployedContentDatabase_({ type, version }: TProps) {
  const {
    teamId,
    projectId,
    environmentId,
    serviceId,
    updateService,
    createDeployment,
    refetchService,
    refetchServices,
    refetchDeployments,
    refetchVariables,
    createOrUpdateVariables,
    temporarilyAddNewEntity,
    tokensRef,
    onTokensChanged,
  } = useCreateFirstDeployment();

  const backupsDisabled = type === "redis";

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

  const {
    data: dataDatabase,
    isPending: isPendingDatabase,
    error: errorDatabase,
  } = api.services.getDatabase.useQuery({
    type,
  });

  const versionItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataDatabase?.database.version.options.map((v) => ({
      value: v,
      label: v,
    }));
    return items;
  }, [dataDatabase]);

  const hasNoBuckets = useMemo(() => {
    return dataS3Sources && dataS3Sources.sources.flatMap((s) => s.buckets).length === 0
      ? true
      : false;
  }, [dataS3Sources]);

  const {
    mutateAsync: createFirstDeployment,
    error: errorCreateFirstDeployment,
    isPending: isPendingCreateFirstDeployment,
  } = useMutation({
    mutationKey: ["createFirstDeployment", teamId, projectId, environmentId, serviceId],
    mutationFn: async (formValues: TFormValues) => {
      const { validVariables } = softValidateVariables(formValues.variables);
      if (validVariables.length >= 1) {
        if (!tokensRef.current) {
          toast.warning("Reference variables are loading", {
            description: "Reference variables loading, please wait a bit.",
            duration: 5000,
          });
          return;
        }

        const { variables, variableReferences } = getVariablesPair({
          variables: validVariables,
          tokens: tokensRef.current,
        });

        const { data } = await createOrUpdateVariables({
          type: "service",
          teamId,
          projectId,
          environmentId,
          serviceId,
          variables,
          variableReferences,
        });

        data.variable_references.forEach((v) =>
          temporarilyAddNewEntity(getNewEntityIdForVariable({ name: v.name, value: v.value })),
        );
        data.variables.forEach((v) =>
          temporarilyAddNewEntity(getNewEntityIdForVariable({ name: v.name, value: v.value })),
        );
      }

      const { sourceId, bucketName } = getSourceIdAndBucketNameFromValue(
        formValues.sourceAndBucket,
      );
      const s3Props =
        sourceId && bucketName ? { s3BackupSourceId: sourceId, s3BackupBucket: bucketName } : {};

      await updateService({
        teamId,
        projectId,
        environmentId,
        serviceId,
        databaseConfig: {
          version: formValues.version,
        },
        ...s3Props,
      });

      await createDeployment({
        teamId,
        projectId,
        environmentId,
        serviceId,
      });
    },
    onSuccess: async () => {
      const result = await ResultAsync.fromPromise(
        Promise.all([
          refetchService(),
          refetchServices(),
          refetchDeployments(),
          refetchVariables(),
        ]),
        () => new Error(`Failed to refetch`),
      );
      if (result.isErr()) {
        toast.error(result.error.message, {
          description: "Failed to refetch service, deployments, or variables.",
        });
      }
    },
  });

  const form = useAppForm({
    defaultValues: {
      version: version,
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
      sourceAndBucket: "",
    },
    validators: {
      onChange: ({ value }) => {
        let fieldsErrorMap: Record<string, { message: string }> = {};

        const variables = value.variables;
        const { errorMap: variablesErrorMap } = softValidateVariables(variables);
        if (variablesErrorMap) {
          fieldsErrorMap = {
            ...fieldsErrorMap,
            ...variablesErrorMap,
            variables: { message: "Not all variables are valid." },
          };
        }

        const result = Object.keys(fieldsErrorMap).length > 0 ? { fields: fieldsErrorMap } : null;
        return result;
      },
    },
    onSubmit: async ({ value }) => await createFirstDeployment(value),
  });

  const CreateBackupSourceTriggerMemoized = useCallback(
    (props: Omit<TCreateBackupSourceTriggerProps, "teamId">) => (
      <CreateBackupSourceTrigger teamId={teamId} {...props} />
    ),
    [teamId],
  );

  return (
    <WrapperForm
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.validateArrayFieldsStartingFrom("variables", 0, "submit");
        form.handleSubmit(e);
      }}
    >
      <WrapperInner>
        {errorCreateFirstDeployment && <ErrorLine message={errorCreateFirstDeployment.message} />}
        {/* Repository and Branch */}
        <Block>
          {/* Repository */}
          <BlockItem>
            <BlockItemHeader>
              <BlockItemTitle>Database</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <BlockItemButtonLike
                asElement="div"
                text={databaseTypeToName(type)}
                Icon={({ className }) => (
                  <BrandIcon brand={type} color="brand" className={className} />
                )}
              />
            </BlockItemContent>
          </BlockItem>
          {/* Branch */}
          <BlockItem>
            <BlockItemHeader>
              <BlockItemTitle>Version</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <form.AppField
                name="version"
                children={(field) => (
                  <field.AsyncDropdownMenu
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    items={versionItems}
                    isPending={isPendingDatabase}
                    error={errorDatabase?.message}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        text={field.state.value}
                        Icon={({ className }) => (
                          <MilestoneIcon className={cn("scale-90", className)} />
                        )}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </field.AsyncDropdownMenu>
                )}
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
        {!backupsDisabled && (
          <Block>
            <BlockItem>
              <BlockItemHeader>
                <BlockItemTitle>Backup Bucket</BlockItemTitle>
              </BlockItemHeader>
              <BlockItemContent>
                <form.AppField
                  name="sourceAndBucket"
                  children={(field) => (
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
                  )}
                />
              </BlockItemContent>
            </BlockItem>
          </Block>
        )}
        {/* @ts-expect-error: This type is completely fine. The form here encapculates the variable only form but it doesn't work for some reason */}
        <VariablesBlock form={form} onTokensChanged={onTokensChanged} />
      </WrapperInner>
      <form.Subscribe
        selector={(s) => ({ isSubmitting: s.isSubmitting })}
        children={({ isSubmitting }) => (
          <DeployButtonSection isPending={isSubmitting || isPendingCreateFirstDeployment} />
        )}
      />
    </WrapperForm>
  );
}

function SourceAndBucketCommandItemElement({
  item,
  className,
}: {
  item: TCommandItem;
  className?: string;
}) {
  return (
    <p className={cn("min-w-0 shrink leading-tight", className)}>
      {item.label.split(sourceAndBucketSeparator)[0]}
      <span className="text-muted-more-foreground px-[0.5ch]">/</span>
      {item.label.split(sourceAndBucketSeparator)[1]}
    </p>
  );
}

type TCreateBackupSourceTriggerProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  children: ReactNode;
  teamId: string;
};

function CreateBackupSourceTrigger({
  teamId,
  isOpen,
  setIsOpen,
  children,
}: TCreateBackupSourceTriggerProps) {
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent animate={false} className="w-[var(--radix-popper-anchor-width)]">
        <ScrollArea>
          <DropdownMenuLabel className="border-b px-3">
            {"You don't have any buckets. Create a backup source."}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <NewS3SourceTrigger teamId={teamId}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-1.5">
                <PlusIcon className="-ml-1 size-5" />
                <p className="min-w-0 shrink">Create Backup Source</p>
              </DropdownMenuItem>
            </NewS3SourceTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getSourceAndBucketLabelFromValue(value: string): string {
  const parts = value.split(sourceAndBucketSeparator);
  return `${parts[1]}${sourceAndBucketSeparator}${parts[parts.length - 1]}`;
}

function getSourceIdAndBucketNameFromValue(value: string) {
  const parts = value.split(sourceAndBucketSeparator);
  if (parts.length < 3) {
    return {
      sourceId: undefined,
      bucketName: undefined,
    };
  }
  return {
    sourceId: parts[parts.length - 2],
    bucketName: parts[parts.length - 1],
  };
}

type TFormValues = {
  version: string;
  variables: TVariableForCreate[];
  sourceAndBucket: string;
};
