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

const cpuLimits = {
  min: 500,
  max: 32000,
  step: 500,
  unlimited: 32500,
};

const memoryLimits = {
  min: 500,
  max: 32000,
  step: 500,
  unlimited: 32500,
};

function GitOrDockerImageSectionContent({ service }: { service: TServiceShallow }) {
  const form = useAppForm({
    defaultValues: {
      instanceCount: service.config.replicas,
      startCommand: service.config.run_command,
      cpuMillicores: cpuLimits.unlimited,
      memoryMb: memoryLimits.unlimited,
    },
  });

  return (
    <form className="flex w-full flex-col gap-6">
      <form.AppField
        name="instanceCount"
        children={(field) => (
          <Block>
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>Instances</BlockItemTitle>
                <BlockItemDescription>
                  The number of instances/replicas to run for this service.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <div className="flex w-full flex-col rounded-lg border pb-1.5">
                  <ValueTitle
                    title="Instances"
                    value={field.state.value ? field.state.value.toString() : "1"}
                  />
                  <field.StorageSizeInput
                    field={field}
                    className="w-full px-3.5 py-3"
                    onBlur={field.handleBlur}
                    min={1}
                    max={10}
                    step={1}
                    hideMinMax
                    defaultValue={[service.config.replicas]}
                    value={field.state.value ? [field.state.value] : undefined}
                    onValueChange={(value) => {
                      field.handleChange(value[0]);
                    }}
                  />
                </div>
              </BlockItemContent>
            </BlockItem>
          </Block>
        )}
      />
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle>Resource Limits</BlockItemTitle>
            <BlockItemDescription>
              The maximum vCPU and memory to allocate for each instance.
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
            <div className="flex w-full flex-col rounded-lg border">
              <form.AppField
                name="cpuMillicores"
                children={(field) => (
                  <div className="flex w-full flex-col pb-1.5">
                    <ValueTitle title="vCPU" value={cpuFormatter(field.state.value)} />
                    <field.StorageSizeInput
                      field={field}
                      className="w-full px-3.5 py-3"
                      onBlur={field.handleBlur}
                      min={cpuLimits.min}
                      max={cpuLimits.unlimited}
                      step={cpuLimits.step}
                      hideMinMax
                      defaultValue={[cpuLimits.unlimited]}
                      value={field.state.value ? [field.state.value] : undefined}
                      onValueChange={(value) => {
                        field.handleChange(value[0]);
                      }}
                    />
                  </div>
                )}
              />
              <div className="bg-border h-px w-full" />
              <form.AppField
                name="memoryMb"
                children={(field) => (
                  <div className="flex w-full flex-col pb-1.5">
                    <ValueTitle title="Memory" value={memoryFormatter(field.state.value)} />
                    <field.StorageSizeInput
                      field={field}
                      className="w-full px-3.5 py-3"
                      onBlur={field.handleBlur}
                      min={memoryLimits.min}
                      max={memoryLimits.unlimited}
                      step={memoryLimits.step}
                      hideMinMax
                      defaultValue={[memoryLimits.unlimited]}
                      value={field.state.value ? [field.state.value] : undefined}
                      onValueChange={(value) => {
                        field.handleChange(value[0]);
                      }}
                    />
                  </div>
                )}
              />
            </div>
          </BlockItemContent>
        </BlockItem>
      </Block>
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

function cpuFormatter(millicores: number) {
  if (millicores > cpuLimits.max) return "Unlimited";
  const cpu = Math.round((millicores / 1000) * 100) / 100;
  return cpu.toString();
}

function memoryFormatter(mb: number) {
  if (mb > memoryLimits.max) return "Unlimited";
  return Math.round((mb / 1000) * 100) / 100 + " GB";
}

function ValueTitle({ title, value }: { title: string; value: string }) {
  return (
    <p className="text-muted-foreground w-full px-3 pt-2.25 pb-1 leading-tight font-medium">
      {title}: <span className="text-foreground font-bold">{value}</span>
    </p>
  );
}
