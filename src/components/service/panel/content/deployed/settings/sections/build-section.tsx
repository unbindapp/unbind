import { builderEnumToName } from "@/components/command-panel/context-command-panel/items/git";
import BrandIcon from "@/components/icons/brand";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import SettingsSectionWrapper from "@/components/settings/settings-section-wrapper";
import { TGitSectionContentProps } from "@/components/settings/types";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  GitServiceBuilderEnum,
  TGitServiceBuilder,
  TServiceShallow,
} from "@/server/trpc/api/services/types";
import { Toggleable, Toggled, Untoggled } from "@/components/toggleable";
import { PlusIcon } from "lucide-react";
import { useRef } from "react";

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

function GitSection({ service }: TGitSectionContentProps) {
  const form = useAppForm({
    defaultValues: {
      builder: service.config.builder,
      installCommand: service.config.install_command,
      buildCommand: service.config.build_command,
      dockerBuilderPath: service.config.docker_builder_path,
      dockerBuilderContext: service.config.docker_builder_context,
    },
  });

  const installCommandInputRef = useRef<HTMLInputElement>(null);
  const buildCommandInputRef = useRef<HTMLInputElement>(null);
  const dockerBuilderPathInputRef = useRef<HTMLInputElement>(null);
  const dockerBuilderContextInputRef = useRef<HTMLInputElement>(null);

  return (
    <SettingsSectionWrapper asElement="form" className="flex w-full flex-col">
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader>
            <BlockItemTitle>Builder</BlockItemTitle>
          </BlockItemHeader>
          <BlockItemContent>
            <form.AppField
              name="builder"
              children={(field) => (
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
              )}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
      <form.Subscribe
        selector={(s) => ({ builder: s.values.builder })}
        children={({ builder }) => {
          return (
            <>
              {/* Install Command */}
              {builder === "railpack" && (
                <Block>
                  <BlockItem className="w-full md:w-full">
                    <BlockItemHeader>
                      <BlockItemTitle>Install Command</BlockItemTitle>
                    </BlockItemHeader>
                    <BlockItemContent>
                      <Toggleable toggledInitial={service.config.install_command !== undefined}>
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
                            <form.AppField
                              name="installCommand"
                              children={(field) => (
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
                            />
                          )}
                        </Toggled>
                      </Toggleable>
                    </BlockItemContent>
                  </BlockItem>
                </Block>
              )}
              {/* Build Command */}
              {builder === "railpack" && (
                <Block>
                  <BlockItem className="w-full md:w-full">
                    <BlockItemHeader>
                      <BlockItemTitle>Build Command</BlockItemTitle>
                    </BlockItemHeader>
                    <BlockItemContent>
                      <Toggleable toggledInitial={service.config.build_command !== undefined}>
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
                            <form.AppField
                              name="buildCommand"
                              children={(field) => (
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
                            />
                          )}
                        </Toggled>
                      </Toggleable>
                    </BlockItemContent>
                  </BlockItem>
                </Block>
              )}
              {/* Dockerfile Path */}
              {builder === "docker" && (
                <Block>
                  <form.AppField
                    name="dockerBuilderPath"
                    children={(field) => (
                      <BlockItem className="w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle>Dockerfile Path</BlockItemTitle>
                          <BlockItemDescription>
                            The path to the Dockerfile in your repository.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <Toggleable
                            toggledInitial={service.config.docker_builder_path !== undefined}
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
              {/* Dockerfile context */}
              {builder === "docker" && (
                <Block>
                  <form.AppField
                    name="dockerBuilderContext"
                    children={(field) => (
                      <BlockItem className="w-full md:w-full">
                        <BlockItemHeader type="column">
                          <BlockItemTitle>Docker Build Context</BlockItemTitle>
                          <BlockItemDescription>
                            The directory that serves as the build context for Docker.
                          </BlockItemDescription>
                        </BlockItemHeader>
                        <BlockItemContent>
                          <Toggleable
                            toggledInitial={service.config.docker_builder_context !== undefined}
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
            </>
          );
        }}
      />
    </SettingsSectionWrapper>
  );
}
