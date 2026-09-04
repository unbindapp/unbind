import { builderEnumToName } from "@/components/command-panel/context-command-panel/items/git";
import BrandIcon from "@/components/icons/brand";
import { cn } from "@/components/ui/utils";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import type { TServiceChangeField } from "@/components/changes/types";
import {
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { TGitSectionProps } from "@/components/settings/types";
import { Toggleable, Toggled, Untoggled } from "@/components/toggleable";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { GitServiceBuilderEnum, TGitServiceBuilder, TServiceShallow } from "@/lib/queries/services";
import { PlusIcon, WrenchIcon } from "lucide-react";
import { useMemo, useRef } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function BuildSection({ service }: TProps) {
  if (service.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorWithWrapper message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return (
      <GitSection
        owner={service.git_repository_owner}
        repo={service.git_repository}
        branch={service.config.git_branch}
        installationId={service.github_installation_id}
        service={service}
      />
    );
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

type TCommandField = Extract<
  TServiceChangeField,
  | "railpackBuilderInstallCommand"
  | "railpackBuilderBuildCommand"
  | "dockerBuilderDockerfilePath"
  | "dockerBuilderBuildContext"
  | "startCommand"
>;

const commandFields: Record<
  TCommandField,
  { title: string; description: string; toggleText: string; placeholder: string }
> = {
  railpackBuilderInstallCommand: {
    title: "Install Command",
    description: "The command for installing the dependencies for the service.",
    toggleText: "Custom install command",
    placeholder: "npm install --force",
  },
  railpackBuilderBuildCommand: {
    title: "Build Command",
    description: "The command for building the service.",
    toggleText: "Custom build command",
    placeholder: "npm run build",
  },
  dockerBuilderDockerfilePath: {
    title: "Dockerfile Path",
    description: "The path to the Dockerfile in your repository.",
    toggleText: "Custom Dockerfile path",
    placeholder: "./Dockerfile",
  },
  dockerBuilderBuildContext: {
    title: "Build Context",
    description: "The directory that serves as the build context for Docker.",
    toggleText: "Custom build context",
    placeholder: "./",
  },
  startCommand: {
    title: "Start Command",
    description: "The command to run to start the new deployment.",
    toggleText: "Custom start command",
    placeholder: "npm run start",
  },
};

function GitSection({ service }: TGitSectionProps) {
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);
  const { staged, stage } = useServiceChanges(service);

  const serverValues: Record<TCommandField, string> = {
    railpackBuilderInstallCommand: service.config.railpack_builder_install_command || "",
    railpackBuilderBuildCommand: service.config.railpack_builder_build_command || "",
    dockerBuilderDockerfilePath: service.config.docker_builder_dockerfile_path || "",
    dockerBuilderBuildContext: service.config.docker_builder_build_context || "",
    startCommand: service.config.run_command || "",
  };

  const form = useAppForm({
    defaultValues: {
      builder: stagedString(staged.builder, service.config.builder) as TGitServiceBuilder,
      railpackBuilderInstallCommand: stagedString(
        staged.railpackBuilderInstallCommand,
        serverValues.railpackBuilderInstallCommand,
      ),
      railpackBuilderBuildCommand: stagedString(
        staged.railpackBuilderBuildCommand,
        serverValues.railpackBuilderBuildCommand,
      ),
      dockerBuilderDockerfilePath: stagedString(
        staged.dockerBuilderDockerfilePath,
        serverValues.dockerBuilderDockerfilePath,
      ),
      dockerBuilderBuildContext: stagedString(
        staged.dockerBuilderBuildContext,
        serverValues.dockerBuilderBuildContext,
      ),
      startCommand: stagedString(staged.startCommand, serverValues.startCommand),
    },
  });
  useResetFormOnStagedChange(form, staged, [
    "builder",
    "railpackBuilderInstallCommand",
    "railpackBuilderBuildCommand",
    "dockerBuilderDockerfilePath",
    "dockerBuilderBuildContext",
    "startCommand",
  ]);

  const inputRefs = {
    railpackBuilderInstallCommand: useRef<HTMLInputElement>(null),
    railpackBuilderBuildCommand: useRef<HTMLInputElement>(null),
    dockerBuilderDockerfilePath: useRef<HTMLInputElement>(null),
    dockerBuilderBuildContext: useRef<HTMLInputElement>(null),
    startCommand: useRef<HTMLInputElement>(null),
  };

  const stageCommand = (field: TCommandField, value: string) =>
    stage({
      field,
      label: commandFields[field].title,
      value,
      previous: serverValues[field],
      format: (v) => v || "Default",
    });

  const commandBlock = (field: TCommandField) => (
    <Block>
      <form.AppField
        name={field}
        children={(fieldApi) => (
          <BlockItem className="group/item w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle hasChanges={staged[field] !== undefined}>
                {commandFields[field].title}
              </BlockItemTitle>
              <BlockItemDescription>{commandFields[field].description}</BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <Toggleable
                toggledInitial={serverValues[field] !== "" || fieldApi.state.value !== ""}
              >
                <Untoggled>
                  {({ toggle }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      Icon={({ className }) => <PlusIcon className={className} />}
                      text={commandFields[field].toggleText}
                      onClick={() => {
                        toggle(true);
                        setTimeout(() => {
                          inputRefs[field].current?.focus();
                        });
                      }}
                    />
                  )}
                </Untoggled>
                <Toggled>
                  {() => (
                    <fieldApi.TextField
                      ref={inputRefs[field]}
                      field={fieldApi}
                      value={fieldApi.state.value}
                      onBlur={() => {
                        fieldApi.handleBlur();
                        if (fieldApi.state.meta.errors.length > 0) return;
                        stageCommand(field, fieldApi.state.value);
                      }}
                      onChange={(e) => {
                        fieldApi.handleChange(e.target.value);
                      }}
                      placeholder={commandFields[field].placeholder}
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  )}
                </Toggled>
              </Toggleable>
            </BlockItemContent>
          </BlockItem>
        )}
      />
    </Block>
  );

  return (
    <SettingsSection title="Build" id="build" Icon={WrenchIcon} entityId={sectionHighlightId}>
      <Block>
        <form.AppField
          name="builder"
          children={(field) => (
            <BlockItem className="group/item w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={staged.builder !== undefined}>Builder</BlockItemTitle>
                <BlockItemDescription>
                  The builder for building the service to be deployed.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncDropdownMenu
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => {
                    field.handleChange(v as TGitServiceBuilder);
                    stage({
                      field: "builder",
                      label: "Builder",
                      value: v as TGitServiceBuilder,
                      previous: service.config.builder,
                      format: builderEnumToName,
                    });
                  }}
                  items={GitServiceBuilderEnum.options.map((o) => ({
                    label: builderEnumToName(o),
                    value: o,
                  }))}
                  ItemIcon={({ className, value }) => (
                    <BrandIcon brand={value} className={cn(className, "size-4.5")} color="brand" />
                  )}
                  isPending={false}
                  error={undefined}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={builderEnumToName(field.state.value)}
                      Icon={({ className }) => (
                        <BrandIcon
                          brand={field.state.value}
                          className={cn(className, "size-4.5")}
                          color="brand"
                        />
                      )}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                    />
                  )}
                </field.AsyncDropdownMenu>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
      <form.Subscribe
        selector={(s) => ({ builder: s.values.builder })}
        children={({ builder }) => (
          <>
            {builder === "railpack" && commandBlock("railpackBuilderInstallCommand")}
            {builder === "railpack" && commandBlock("railpackBuilderBuildCommand")}
            {builder === "docker" && commandBlock("dockerBuilderDockerfilePath")}
            {builder === "docker" && commandBlock("dockerBuilderBuildContext")}
            {commandBlock("startCommand")}
          </>
        )}
      />
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `build_${service.id}`;
}
