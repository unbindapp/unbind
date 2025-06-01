import ErrorWithWrapper from "@/components/service/panel/content/deployed/settings/shared/error-with-wrapper";
import SettingsSectionWrapper from "@/components/service/panel/content/deployed/settings/shared/settings-section-wrapper";
import {
  Block,
  BlockItem,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";

type TProps = {
  service: TServiceShallow;
};

export default function DeploySection({ service }: TProps) {
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
        <GitOrDockerImageSectionContent service={service} />
      </SettingsSectionWrapper>
    );
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return (
      <SettingsSectionWrapper>
        <GitOrDockerImageSectionContent service={service} />
      </SettingsSectionWrapper>
    );
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function GitOrDockerImageSectionContent({ service }: { service: TServiceShallow }) {
  const form = useAppForm({
    defaultValues: {
      instanceCount: service.config.replicas,
      startCommand: service.config.run_command,
    },
  });

  return (
    <form className="flex w-full flex-col gap-5">
      <form.AppField
        name="instanceCount"
        children={(field) => (
          <Block>
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>
                  Instances:{" "}
                  <span className="text-foreground bg-foreground/6 border-foreground/6 rounded-md border px-1.5">
                    {field.state.value}
                  </span>
                </BlockItemTitle>
                <BlockItemDescription>
                  The number of instances/replicas to run for this service.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <field.StorageSizeInput
                  field={field}
                  className="w-full rounded-lg border px-3.5 py-3"
                  onBlur={field.handleBlur}
                  min={1}
                  max={10}
                  step={1}
                  minMaxFormatter={(value) => value.toString()}
                  defaultValue={[Number(service.config.replicas)]}
                  value={field.state.value ? [Number(field.state.value)] : undefined}
                  onValueChange={(value) => {
                    field.handleChange(value[0]);
                  }}
                />
              </BlockItemContent>
            </BlockItem>
          </Block>
        )}
      />
      <form.AppField
        name="startCommand"
        children={(field) => (
          <Block>
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>Start Command</BlockItemTitle>
                <BlockItemDescription>
                  The command to run to start the deployment.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
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
              </BlockItemContent>
            </BlockItem>
          </Block>
        )}
      />
    </form>
  );
}
