import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import SettingsSectionWrapper from "@/components/settings/settings-section-wrapper";
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
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { Toggleable, Toggled, Untoggled } from "@/components/toggleable";
import { PlusIcon } from "lucide-react";

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

    return <GitOrDockerImageSection service={service} />;
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <GitOrDockerImageSection service={service} />;
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

const cpuLimits = {
  min: 200,
  max: 16000,
  step: 200,
  unlimited: 16200,
};

const memoryLimits = {
  min: 200,
  max: 16000,
  step: 200,
  unlimited: 16200,
};

function GitOrDockerImageSection({ service }: { service: TServiceShallow }) {
  const form = useAppForm({
    defaultValues: {
      instanceCount: service.config.replicas,
      startCommand: service.config.run_command,
      cpuMillicores: cpuLimits.unlimited,
      memoryMb: memoryLimits.unlimited,
      healthCheckEndpoint: service.config.health_check?.path || "",
    },
  });

  return (
    <SettingsSectionWrapper asElement="form" className="flex w-full flex-col">
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
                      defaultValue={[
                        service.config.resources?.cpu_limits_millicores || cpuLimits.unlimited,
                      ]}
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
                      defaultValue={[
                        service.config.resources?.memory_limits_megabytes || memoryLimits.unlimited,
                      ]}
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
      <Block>
        <form.AppField
          name="startCommand"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>Start Command</BlockItemTitle>
                <BlockItemDescription>
                  The command to run to start the new deployment.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <Toggleable toggledInitial={service.config.run_command !== undefined}>
                  <Untoggled>
                    {({ toggle }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        Icon={PlusIcon}
                        text="Add start command"
                        onClick={() => toggle(true)}
                      />
                    )}
                  </Untoggled>
                  <Toggled>
                    {() => (
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
                  </Toggled>
                </Toggleable>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
      <Block>
        <form.AppField
          name="healthCheckEndpoint"
          children={(field) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle>Health Check Endpoint</BlockItemTitle>
                <BlockItemDescription>
                  The endpoint to call to decide if a new deployment is ready.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <Toggleable toggledInitial={service.config.health_check?.path !== undefined}>
                  <Untoggled>
                    {({ toggle }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        Icon={PlusIcon}
                        text="Add endpoint"
                        onClick={() => toggle(true)}
                      />
                    )}
                  </Untoggled>
                  <Toggled>
                    {() => (
                      <field.TextField
                        field={field}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="/health"
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
    </SettingsSectionWrapper>
  );
}

function cpuFormatter(millicores: number) {
  if (millicores > cpuLimits.max) return "Unlimited";
  const cpu = Math.round((millicores / 1000) * 100) / 100;
  return cpu.toFixed(1);
}

function memoryFormatter(mb: number) {
  if (mb > memoryLimits.max) return "Unlimited";
  return `${(Math.round((mb / 1000) * 100) / 100).toFixed(1)} GB`;
}

function ValueTitle({ title, value }: { title: string; value: string }) {
  return (
    <p className="text-muted-foreground w-full px-3.5 pt-2.5 pb-1 leading-tight font-medium">
      <span className="pr-[0.6ch]">{title}:</span>
      <span className="text-foreground font-mono font-bold">{value}</span>
    </p>
  );
}
