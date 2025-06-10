import { builderEnumToName } from "@/components/command-panel/context-command-panel/items/git";
import BrandIcon from "@/components/icons/brand";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { TGitSectionProps } from "@/components/settings/types";
import { Toggleable, Toggled, Untoggled } from "@/components/toggleable";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  GitServiceBuilderEnum,
  TGitServiceBuilder,
  TServiceShallow,
} from "@/server/trpc/api/services/types";
import { useStore } from "@tanstack/react-form";
import { PlusIcon, WrenchIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

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

function GitSection({ service }: TGitSectionProps) {
  const form = useAppForm({
    defaultValues: {
      builder: service.config.builder,
      railpackBuilderInstallCommand: service.config.railpack_builder_install_command || "",
      railpackBuilderBuildCommand: service.config.railpack_builder_build_command || "",
      dockerBuilderDockerfilePath: service.config.docker_builder_dockerfile_path || "",
      dockerBuilderBuildContext: service.config.docker_builder_build_context || "",
      startCommand: service.config.run_command || "",
    },
    onSubmit: ({}) => {
      toast.success("Changes saved successfully.", {
        description: "This is fake",
        duration: 5000,
      });
    },
  });

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.values.builder === "railpack") {
      if (s.fieldMeta.railpackBuilderInstallCommand?.isDefaultValue === false) count++;
      if (s.fieldMeta.railpackBuilderBuildCommand?.isDefaultValue === false) count++;
    }
    if (s.values.builder === "docker") {
      if (s.fieldMeta.dockerBuilderDockerfilePath?.isDefaultValue === false) count++;
      if (s.fieldMeta.dockerBuilderBuildContext?.isDefaultValue === false) count++;
    }
    if (s.fieldMeta.builder?.isDefaultValue === false) count++;
    if (s.fieldMeta.startCommand?.isDefaultValue === false) count++;
    return count;
  });

  const installCommandInputRef = useRef<HTMLInputElement>(null);
  const buildCommandInputRef = useRef<HTMLInputElement>(null);
  const dockerBuilderPathInputRef = useRef<HTMLInputElement>(null);
  const dockerBuilderContextInputRef = useRef<HTMLInputElement>(null);
  const startCommandInputRef = useRef<HTMLInputElement>(null);

  return (
    <SettingsSection
      asElement="form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      title="Build"
      id="build"
      Icon={WrenchIcon}
      changeCount={changeCount}
      onClickResetChanges={() => form.reset()}
      /* SubmitButton={form.SubmitButton} */
    >
      <Block>
        <form.AppField
          name="builder"
          children={(field) => (
            <BlockItem className="group/item w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                  Builder
                </BlockItemTitle>
                <BlockItemDescription>
                  The builder for building the service to be deployed.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <field.AsyncDropdownMenu
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v as TGitServiceBuilder)}
                  items={GitServiceBuilderEnum.options.map((o) => ({
                    label: builderEnumToName(o),
                    value: o,
                  }))}
                  ItemIcon={({ className, value }) => (
                    <BrandIcon brand={value} className={className} color="brand" />
                  )}
                  isPending={false}
                  error={undefined}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={builderEnumToName(field.state.value)}
                      Icon={({ className }) => (
                        <BrandIcon brand={field.state.value} className={className} color="brand" />
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
        children={({ builder }) => {
          return (
            <>
              {/* Railpack builder build command */}
              {builder === "railpack" && (
                <Block>
                  <form.AppField
                    name="railpackBuilderInstallCommand"
                    children={(field) => (
                      <BlockItem className="group/item w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                            Install Command
                          </BlockItemTitle>
                          <BlockItemDescription>
                            The command for installing the dependencies for the service.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <Toggleable
                            toggledInitial={
                              service.config.railpack_builder_install_command !== undefined ||
                              field.state.value !== ""
                            }
                          >
                            <Untoggled>
                              {({ toggle }) => (
                                <BlockItemButtonLike
                                  asElement="button"
                                  Icon={PlusIcon}
                                  text="Custom install command"
                                  onClick={() => {
                                    toggle(true);
                                    setTimeout(() => {
                                      installCommandInputRef.current?.focus();
                                    });
                                  }}
                                />
                              )}
                            </Untoggled>
                            <Toggled>
                              {() => (
                                <field.TextField
                                  ref={installCommandInputRef}
                                  field={field}
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => {
                                    field.handleChange(e.target.value);
                                  }}
                                  placeholder="npm install --force"
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
              )}
              {/* Railpack builder build command */}
              {builder === "railpack" && (
                <Block>
                  <form.AppField
                    name="railpackBuilderBuildCommand"
                    children={(field) => (
                      <BlockItem className="group/item w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                            Build Command
                          </BlockItemTitle>
                          <BlockItemDescription>
                            The command for building the service.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <Toggleable
                            toggledInitial={
                              service.config.railpack_builder_build_command !== undefined ||
                              field.state.value !== ""
                            }
                          >
                            <Untoggled>
                              {({ toggle }) => (
                                <BlockItemButtonLike
                                  asElement="button"
                                  Icon={PlusIcon}
                                  text="Custom build command"
                                  onClick={() => {
                                    toggle(true);
                                    setTimeout(() => {
                                      buildCommandInputRef.current?.focus();
                                    });
                                  }}
                                />
                              )}
                            </Untoggled>
                            <Toggled>
                              {() => (
                                <field.TextField
                                  ref={buildCommandInputRef}
                                  field={field}
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => {
                                    field.handleChange(e.target.value);
                                  }}
                                  placeholder="npm run build"
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
              )}
              {/* Docker builder Dockerfile path */}
              {builder === "docker" && (
                <Block>
                  <form.AppField
                    name="dockerBuilderDockerfilePath"
                    children={(field) => (
                      <BlockItem className="group/item w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                            Dockerfile Path
                          </BlockItemTitle>
                          <BlockItemDescription>
                            The path to the Dockerfile in your repository.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <Toggleable
                            toggledInitial={
                              service.config.docker_builder_dockerfile_path !== undefined ||
                              field.state.value !== ""
                            }
                          >
                            <Untoggled>
                              {({ toggle }) => (
                                <BlockItemButtonLike
                                  asElement="button"
                                  Icon={PlusIcon}
                                  text="Custom Dockerfile path"
                                  onClick={() => {
                                    toggle(true);
                                    setTimeout(() => {
                                      dockerBuilderPathInputRef.current?.focus();
                                    });
                                  }}
                                />
                              )}
                            </Untoggled>
                            <Toggled>
                              {() => (
                                <field.TextField
                                  ref={dockerBuilderPathInputRef}
                                  field={field}
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => {
                                    field.handleChange(e.target.value);
                                  }}
                                  placeholder="./Dockerfile"
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
              )}
              {/* Docker builder build context */}
              {builder === "docker" && (
                <Block>
                  <form.AppField
                    name="dockerBuilderBuildContext"
                    children={(field) => (
                      <BlockItem className="group/item w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                            Build Context
                          </BlockItemTitle>
                          <BlockItemDescription>
                            The directory that serves as the build context for Docker.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <Toggleable
                            toggledInitial={
                              service.config.docker_builder_build_context !== undefined ||
                              field.state.value !== ""
                            }
                          >
                            <Untoggled>
                              {({ toggle }) => (
                                <BlockItemButtonLike
                                  asElement="button"
                                  Icon={PlusIcon}
                                  text="Custom build context"
                                  onClick={() => {
                                    toggle(true);
                                    setTimeout(() => {
                                      dockerBuilderContextInputRef.current?.focus();
                                    });
                                  }}
                                />
                              )}
                            </Untoggled>
                            <Toggled>
                              {() => (
                                <field.TextField
                                  ref={dockerBuilderContextInputRef}
                                  field={field}
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => {
                                    field.handleChange(e.target.value);
                                  }}
                                  placeholder="./"
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
              )}
              <Block>
                <form.AppField
                  name="startCommand"
                  children={(field) => (
                    <BlockItem className="group/item w-full md:w-full">
                      <BlockItemHeader type="column">
                        <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                          Start Command
                        </BlockItemTitle>
                        <BlockItemDescription>
                          The command to run to start the new deployment.
                        </BlockItemDescription>
                      </BlockItemHeader>
                      <BlockItemContent>
                        <Toggleable
                          toggledInitial={
                            service.config.run_command !== undefined || field.state.value !== ""
                          }
                        >
                          <Untoggled>
                            {({ toggle }) => (
                              <BlockItemButtonLike
                                asElement="button"
                                Icon={PlusIcon}
                                text="Custom start command"
                                onClick={() => {
                                  toggle(true);
                                  setTimeout(() => {
                                    startCommandInputRef.current?.focus();
                                  });
                                }}
                              />
                            )}
                          </Untoggled>
                          <Toggled>
                            {() => (
                              <field.TextField
                                ref={startCommandInputRef}
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
                          </Toggled>
                        </Toggleable>
                      </BlockItemContent>
                    </BlockItem>
                  )}
                />
              </Block>
            </>
          );
        }}
      />
    </SettingsSection>
  );
}
