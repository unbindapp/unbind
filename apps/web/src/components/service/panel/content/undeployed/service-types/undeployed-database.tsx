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
} from "@/components/block";
import VariablesBlock from "@/components/service/panel/content/undeployed/blocks/variables-block";
import DeployButtonSection from "@/components/service/panel/content/undeployed/deploy-button-section";
import useCreateFirstDeployment from "@/components/service/panel/content/undeployed/use-create-first-deployment";
import { softValidateVariables } from "@/components/service/panel/content/undeployed/validators";
import { WrapperForm, WrapperInner } from "@/components/service/panel/content/undeployed/wrapper";
import { useService } from "@/components/service/service-provider";
import {
  AddBackupBucketTrigger,
  S3BucketCommandItemElement,
  S3BucketLabel,
  TAddBackupBucketTriggerProps,
} from "@/components/storage/create-backup-bucket-trigger";
import S3BucketsProvider, { useS3Buckets } from "@/components/storage/s3-buckets-provider";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/components/ui/utils";
import { getVariablesPair } from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { TCommandItem } from "@/lib/hooks/use-app-form";
import {
  removeFormDraft,
  useAppFormWithPersistence,
} from "@/lib/hooks/use-app-form-with-persistence";
import { TVariableForCreate } from "@/lib/queries/variables";
import { databaseQuery } from "@/lib/queries/services";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { CylinderIcon, MilestoneIcon, OctagonXIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useCallback, useMemo } from "react";
import { toast } from "@/components/ui/toast";
import { z } from "zod";

type TProps = {
  type: string;
  version: string;
};

const DraftSchema = z.object({
  version: z.string(),
  variables: z.array(z.object({ name: z.string(), value: z.string() })),
  s3BucketId: z.string(),
});

export function UndeployedContentDatabase(props: TProps) {
  const { teamId } = useService();
  return (
    <S3BucketsProvider teamId={teamId}>
      <UndeployedContentDatabase_ {...props} />
    </S3BucketsProvider>
  );
}

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

  const persistenceKey = `undeployed-database:${serviceId}`;

  const backupsDisabled = type === "redis";

  const {
    query: { data: dataS3Buckets, isPending: isPendingS3Buckets, error: errorS3Buckets },
  } = useS3Buckets();

  const s3BucketItems = useMemo(() => {
    const items: TCommandItem[] | undefined = dataS3Buckets?.buckets.map((s3Bucket) => ({
      value: s3Bucket.id,
      label: s3Bucket.name,
      description: s3Bucket.bucket,
    }));
    return items;
  }, [dataS3Buckets]);

  const {
    data: dataDatabase,
    isPending: isPendingDatabase,
    error: errorDatabase,
  } = useQuery(databaseQuery({ type }));

  const versionItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataDatabase?.database.version.options.map((v) => ({
      value: v,
      label: v,
    }));
    return items;
  }, [dataDatabase]);

  const hasNoBuckets = dataS3Buckets ? dataS3Buckets.buckets.length === 0 : false;

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
          toast.add({
            type: "warning",
            title: "Reference variables are loading",
            description: "Reference variables loading, please wait a bit.",
            timeout: 5000,
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

      const s3Props = formValues.s3BucketId ? { s3BackupBucketId: formValues.s3BucketId } : {};

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
      removeFormDraft({ persistenceType: "session", persistenceKey });
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
        toast.add({
          type: "error",
          title: result.error.message,
          description: "Failed to refetch service, deployments, or variables.",
        });
      }
    },
  });

  const form = useAppFormWithPersistence({
    defaultValues: {
      version: version,
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
      s3BucketId: "",
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
    persistenceType: "session",
    persistenceKey,
    persistenceSchema: DraftSchema,
  });

  const AddBackupBucketTriggerMemoized = useCallback(
    (props: Omit<TAddBackupBucketTriggerProps, "teamId">) => (
      <AddBackupBucketTrigger teamId={teamId} {...props} />
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
        {/* Database and Version */}
        <Block>
          {/* Database */}
          <BlockItem>
            <BlockItemHeader>
              <BlockItemTitle>Database</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <BlockItemButtonLike
                asElement="div"
                text={databaseTypeToName(type)}
                Icon={({ className }) => (
                  <BrandIcon brand={type} color="brand" className={cn(className, "size-4.5")} />
                )}
              />
            </BlockItemContent>
          </BlockItem>
          {/* Version */}
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
                          <MilestoneIcon className={cn(className, "size-4.5")} />
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
                  name="s3BucketId"
                  children={(field) => (
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
                          />
                        );
                      }}
                    </field.AsyncAndSearchableSelect>
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

type TFormValues = {
  version: string;
  variables: TVariableForCreate[];
  s3BucketId: string;
};
