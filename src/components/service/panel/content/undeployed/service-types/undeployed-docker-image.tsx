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
import { cn } from "@/components/ui/utils";
import { getVariablesPair } from "@/components/variables/helpers";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { defaultDebounceMs } from "@/lib/constants";
import { generateDomain } from "@/lib/helpers/generate-domain";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TVariableForCreate } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { TagIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

type TProps = {
  image: string;
  tag: string;
  detectedPort: string | undefined;
};

export function UndeployedContentDockerImage({ image, tag, detectedPort }: TProps) {
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

  const tagItems = useMemo(() => {
    return dataTags?.tags?.map((b) => b.name);
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
};
