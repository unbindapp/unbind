import { useSettingsSectionSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import { useStore } from "@tanstack/react-form";
import { settingsIds } from "@/components/settings/settings-ids";
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
import type { TServiceChangeField } from "@/components/staged-changes/types";
import {
  stagedString,
  useResetFormOnStagedChange,
  hasApplying,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import WatchPathsInput from "@/components/service/panel/content/deployed/settings/sections/watch-paths-input";
import { SettingsSection } from "@/components/settings/settings-section";
import { TGitSectionProps } from "@/components/settings/types";
import { Toggleable, Toggled, Untoggled } from "@/components/toggleable";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { GitServiceBuilderEnum, TGitServiceBuilder, TServiceShallow } from "@/lib/queries/services";
import { formatWatchPaths, joinWatchPaths, splitWatchPaths } from "@/lib/watch-paths";
import { PlusIcon, WrenchIcon } from "lucide-react";
import { useMemo, useRef } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function BuildSection({ service }: TProps) {
  const { isSectionVisible } = useSettingsSectionSearch("build");
  if (!isSectionVisible) return null;
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
  { id: string; title: string; description: string; toggleText: string; placeholder: string }
> = {
  railpackBuilderInstallCommand: {
    title: "Install Command",
    id: settingsIds.build.installCommand,
    description: "The command for installing the dependencies for the service.",
    toggleText: "Custom install command",
    placeholder: "npm install --force",
  },
  railpackBuilderBuildCommand: {
    title: "Build Command",
    id: settingsIds.build.buildCommand,
    description: "The command for building the service.",
    toggleText: "Custom build command",
    placeholder: "npm run build",
  },
  dockerBuilderDockerfilePath: {
    title: "Dockerfile Path",
    id: settingsIds.build.dockerfilePath,
    description: "The path to the Dockerfile in your repository.",
    toggleText: "Custom Dockerfile path",
    placeholder: "./Dockerfile",
  },
  dockerBuilderBuildContext: {
    title: "Build Context",
    id: settingsIds.build.buildContext,
    description: "The directory that serves as the build context for Docker.",
    toggleText: "Custom build context",
    placeholder: "./",
  },
  startCommand: {
    title: "Start Command",
    id: settingsIds.build.startCommand,
    description: "The command to run to start the new deployment.",
    toggleText: "Custom start command",
    placeholder: "npm run start",
  },
};

const buildFields: TServiceChangeField[] = [
  "builder",
  "railpackBuilderInstallCommand",
  "railpackBuilderBuildCommand",
  "dockerBuilderDockerfilePath",
  "dockerBuilderBuildContext",
  "startCommand",
  "watchPaths",
];

function GitSection({ service }: TGitSectionProps) {
  const { isItemVisible } = useSettingsSectionSearch("build");
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);
  const serverValues: Record<TCommandField, string> = {
    railpackBuilderInstallCommand: service.config.railpack_builder_install_command || "",
    railpackBuilderBuildCommand: service.config.railpack_builder_build_command || "",
    dockerBuilderDockerfilePath: service.config.docker_builder_dockerfile_path || "",
    dockerBuilderBuildContext: service.config.docker_builder_build_context || "",
    startCommand: service.config.run_command || "",
  };
  const serverWatchPaths = joinWatchPaths(service.config.watch_paths);
  const { staged, stage, unstage } = useServiceChanges(service, {
    builder: service.config.builder,
    ...serverValues,
    watchPaths: serverWatchPaths,
  });

  const defaultValues = {
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
    watchPaths: stagedString(staged.watchPaths, serverWatchPaths),
  };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, buildFields);

  const inputRefs = {
    railpackBuilderInstallCommand: useRef<HTMLInputElement>(null),
    railpackBuilderBuildCommand: useRef<HTMLInputElement>(null),
    dockerBuilderDockerfilePath: useRef<HTMLInputElement>(null),
    dockerBuilderBuildContext: useRef<HTMLInputElement>(null),
    startCommand: useRef<HTMLInputElement>(null),
  };

  const builder = useStore(form.store, (s) => s.values.builder);
  const builderCommandFields: TCommandField[] = [
    ...(builder === "railpack"
      ? (["railpackBuilderInstallCommand", "railpackBuilderBuildCommand"] as const)
      : []),
    ...(builder === "docker"
      ? (["dockerBuilderDockerfilePath", "dockerBuilderBuildContext"] as const)
      : []),
    "startCommand",
  ];
  const visibleCommandFields = builderCommandFields.filter((field) =>
    isItemVisible(commandFields[field].id),
  );
  const showBuilder = isItemVisible(settingsIds.build.builder);
  const showWatchPaths = isItemVisible(settingsIds.build.watchPaths);
  if (!showBuilder && visibleCommandFields.length === 0 && !showWatchPaths) return null;

  const stageCommand = (field: TCommandField, value: string) =>
    stage({
      field,
      label: commandFields[field].title,
      value,
      previous: serverValues[field],
      format: (v) => v || "Default",
    });

  const commandBlock = (field: TCommandField) => (
    <Block key={field}>
      <form.AppField
        name={field}
        children={(fieldApi) => (
          <BlockItem id={commandFields[field].id} className="group/item w-full md:w-full">
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
                      onBlur={fieldApi.handleBlur}
                      onChange={(e) => {
                        fieldApi.handleChange(e.target.value);
                        stageCommand(field, e.target.value);
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
    <SettingsSection
      title="Build"
      id="build"
      Icon={WrenchIcon}
      entityId={sectionHighlightId}
      hasChanges={buildFields.some((field) => staged[field] !== undefined)}
      isApplying={hasApplying(staged, buildFields)}
      onDiscard={() => unstage(buildFields)}
    >
      {showBuilder && (
        <Block>
          <form.AppField
            name="builder"
            children={(field) => (
              <BlockItem id={settingsIds.build.builder} className="group/item w-full md:w-full">
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
                      <BrandIcon
                        brand={value}
                        className={cn(className, "size-4.5")}
                        color="brand"
                      />
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
      )}
      {visibleCommandFields.map(commandBlock)}
      {showWatchPaths && (
        <Block>
          <form.AppField
            name="watchPaths"
            children={(field) => (
              <BlockItem id={settingsIds.build.watchPaths} className="group/item w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle hasChanges={staged.watchPaths !== undefined}>
                    Watch Paths
                  </BlockItemTitle>
                  <BlockItemDescription>
                    Gitignore-style patterns. Leave empty to deploy on every push.
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContent>
                  <WatchPathsInput
                    service={service}
                    value={splitWatchPaths(field.state.value)}
                    onChange={(patterns) => {
                      const joined = joinWatchPaths(patterns);
                      field.handleChange(joined);
                      stage({
                        field: "watchPaths",
                        label: "Watch paths",
                        value: joined,
                        previous: serverWatchPaths,
                        format: formatWatchPaths,
                      });
                    }}
                  />
                </BlockItemContent>
              </BlockItem>
            )}
          />
        </Block>
      )}
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `build_${service.id}`;
}
