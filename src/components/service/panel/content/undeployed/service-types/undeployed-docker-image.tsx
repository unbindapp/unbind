import { isNonDockerHubImage } from "@/components/command-panel/context-command-panel/items/docker-image";
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
import DomainPortBlock from "@/components/service/panel/content/undeployed/blocks/domain-port-block";
import VariablesBlock from "@/components/service/panel/content/undeployed/blocks/variables-block";
import DeployButtonSection from "@/components/service/panel/content/undeployed/deploy-button-section";
import useCreateFirstDeployment from "@/components/service/panel/content/undeployed/use-create-first-deployment";
import { softValidateVariables } from "@/components/service/panel/content/undeployed/validators";
import { WrapperForm, WrapperInner } from "@/components/service/panel/content/undeployed/wrapper";
import { useSystem } from "@/components/system/system-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { getVariablesPair } from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { defaultDebounceMs } from "@/lib/constants";
import { generateDomain } from "@/lib/helpers/generate-domain";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { TVariableForCreate } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { ChevronUpIcon, CogIcon, TagIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

type TProps = {
  image: string;
  tag: string;
  detectedPort: string | undefined;
  service: TServiceShallow;
};

export function UndeployedContentDockerImage({ image, tag, detectedPort, service }: TProps) {
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

  const [commandInputValue, setCommandInputValue] = useState("");
  const imageIsNonDockerHub = isNonDockerHubImage(image);
  const [search] = useDebounce(commandInputValue, defaultDebounceMs);

  const {
    data: dataTags,
    isPending: isPendingTags,
    error: errorTags,
  } = api.docker.listTags.useQuery(
    {
      repository: image,
      search: commandInputValue ? search : commandInputValue,
    },
    {
      enabled: !imageIsNonDockerHub,
    },
  );

  const tagItems: TCommandItem[] | undefined = useMemo(() => {
    const items: TCommandItem[] | undefined = dataTags?.tags?.map((b) => ({
      value: b.name,
      label: b.name,
    }));
    return items;
  }, [dataTags]);

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

      const extraProps: {
        startCommand?: string;
      } = {};

      if (formValues.startCommand !== service.config.run_command || "") {
        extraProps.startCommand = formValues.startCommand;
      }

      await updateService({
        teamId,
        projectId,
        environmentId,
        serviceId,
        image: `${image}:${formValues.tag}`,
        isPublic: formValues.isPublic,
        hosts: !formValues.isPublic
          ? undefined
          : [{ host: formValues.domain, port: Number(formValues.port), path: "" }],
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

  const { data: systemData } = useSystem();
  const wildcardUrl = systemData?.data.system_settings.wildcard_domain;
  const wildcardDomain = wildcardUrl ? new URL(wildcardUrl).hostname : undefined;
  const autoGeneratedDomain = useMemo(() => {
    if (!wildcardDomain) return undefined;
    const imageParts = image.split("/");
    const imageName = imageParts[imageParts.length - 1];
    const domain = generateDomain(imageName, wildcardDomain);
    return domain;
  }, [wildcardDomain, image]);

  const form = useAppForm({
    defaultValues: {
      image: image,
      tag: tag,
      domain: autoGeneratedDomain || "",
      isPublic: true,
      port: detectedPort !== undefined ? detectedPort : "",
      variables: [{ name: "", value: "" }] as TVariableForCreate[],
      startCommand: service.config.run_command || "",
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

  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);

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
              <BlockItemTitle>Image</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <BlockItemButtonLike
                asElement="div"
                text={image}
                Icon={({ className }) => (
                  <BrandIcon brand="docker" color="brand" className={className} />
                )}
              />
            </BlockItemContent>
          </BlockItem>
          {/* Branch */}
          <BlockItem>
            <BlockItemHeader>
              <BlockItemTitle>Tag</BlockItemTitle>
            </BlockItemHeader>
            <BlockItemContent>
              <form.AppField
                name="tag"
                children={(field) => (
                  <field.AsyncCommandDropdown
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    items={tagItems}
                    isPending={isPendingTags}
                    error={errorTags?.message}
                    commandInputPlaceholder="Search tags..."
                    commandEmptyText="No tags found"
                    CommandEmptyIcon={TagIcon}
                    commandShouldntFilter={true}
                    commandInputValue={commandInputValue}
                    commandInputValueOnChange={(v) => setCommandInputValue(v)}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        text={field.state.value}
                        Icon={({ className }) => <TagIcon className={cn("scale-90", className)} />}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        disabled={imageIsNonDockerHub}
                        hideChevron={imageIsNonDockerHub}
                        fadeOnDisabled={false}
                      />
                    )}
                  </field.AsyncCommandDropdown>
                )}
              />
            </BlockItemContent>
          </BlockItem>
        </Block>
        <DomainPortBlock
          // @ts-expect-error: This type is completely fine. The form here encapculates the domain & port only form but it doesn't work for some reason
          form={form}
          detectedPort={detectedPort}
          autoGeneratedDomain={autoGeneratedDomain}
        />
        {/* @ts-expect-error: This type is completely fine. The form here encapculates the variable only form but it doesn't work for some reason */}
        <VariablesBlock form={form} onTokensChanged={onTokensChanged} />
        <div
          data-open={isAdvancedSettingsOpen ? true : undefined}
          className="group/section -mt-2 flex w-full flex-col rounded-lg border md:-mt-3"
        >
          <Button
            className="text-muted-foreground justify-start gap-2 rounded-md px-3 py-2.75 text-left font-semibold group-data-open/section:rounded-b-none"
            variant="ghost"
            type="button"
            onClick={() => setIsAdvancedSettingsOpen((o) => !o)}
          >
            <div className="relative size-5 shrink-0 transition-transform group-data-open/section:rotate-180">
              <CogIcon className="size-full scale-90 transition-opacity group-data-open/section:opacity-0" />
              <ChevronUpIcon className="absolute top-0 left-0 size-full -rotate-180 opacity-0 transition-opacity group-data-open/section:opacity-100" />
            </div>
            <p className="min-w-0 shrink">Advanced Settings</p>
          </Button>
          {isAdvancedSettingsOpen && (
            <div className="flex w-full flex-col gap-6 px-2.5 py-3 sm:p-4 sm:pt-3">
              <Block>
                {/* Start Command */}
                <BlockItem>
                  <BlockItemHeader>
                    <BlockItemTitle>Start Command</BlockItemTitle>
                  </BlockItemHeader>
                  <BlockItemContent>
                    <form.AppField
                      name="startCommand"
                      children={(field) => (
                        <field.TextField
                          field={field}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                          }}
                          placeholder="npm run start"
                          autoCapitalize="off"
                          autoCorrect="off"
                          autoComplete="off"
                          spellCheck="false"
                        />
                      )}
                    />
                  </BlockItemContent>
                </BlockItem>
              </Block>
            </div>
          )}
        </div>
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
  tag: string;
  port: string;
  variables: TVariableForCreate[];
  isPublic: boolean;
  domain: string;
  startCommand: string;
};
