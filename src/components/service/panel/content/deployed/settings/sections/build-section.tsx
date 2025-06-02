import { builderEnumToName } from "@/components/command-panel/context-command-panel/items/git";
import BrandIcon from "@/components/icons/brand";
import ErrorWithWrapper from "@/components/service/panel/content/deployed/settings/shared/error-with-wrapper";
import SettingsSectionWrapper from "@/components/service/panel/content/deployed/settings/shared/settings-section-wrapper";
import { TGitSectionContentProps } from "@/components/service/panel/content/deployed/settings/shared/types";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  GitServiceBuilderEnum,
  TGitServiceBuilder,
  TServiceShallow,
} from "@/server/trpc/api/services/types";

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
      <SettingsSectionWrapper>
        <GitSectionContent
          owner={service.git_repository_owner}
          repo={service.git_repository}
          branch={service.config.git_branch}
          installationId={service.github_installation_id}
          service={service}
        />
      </SettingsSectionWrapper>
    );
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function GitSectionContent({ service }: TGitSectionContentProps) {
  const form = useAppForm({
    defaultValues: {
      builder: service.config.builder,
      installCommand: service.config.install_command,
      buildCommand: service.config.build_command,
    },
  });

  return (
    <form className="flex w-full flex-col gap-6">
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
                      <form.AppField
                        name="installCommand"
                        children={(field) => (
                          <field.TextField
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
                      <form.AppField
                        name="buildCommand"
                        children={(field) => (
                          <field.TextField
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
                    </BlockItemContent>
                  </BlockItem>
                </Block>
              )}
            </>
          );
        }}
      />
    </form>
  );
}
