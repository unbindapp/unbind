import {
  Block,
  BlockItem,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import useUpdateService, {
  TUpdateServiceInputSimple,
} from "@/components/service/use-update-service";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { useStore } from "@tanstack/react-form";
import { RocketIcon } from "lucide-react";
import { useMemo } from "react";

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
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  const {
    mutateAsync: updateService,
    isPending: isPendingUpdate,
    error: errorUpdate,
    reset: resetUpdate,
  } = useUpdateService({
    onSuccess: async () => {
      form.reset();
    },
    idToHighlight: sectionHighlightId,
  });

  const form = useAppForm({
    defaultValues: {
      instanceCount: service.config.replicas,
      cpuLimitMillicores: service.config.resources?.cpu_limits_millicores || cpuLimits.unlimited,
      memoryLimitMb: service.config.resources?.memory_limits_megabytes || memoryLimits.unlimited,
    },
    onSubmit: async ({ formApi, value }) => {
      let hasChanged = false;
      const changes: TUpdateServiceInputSimple = {};

      if (formApi.getFieldMeta("instanceCount")?.isDefaultValue === false) {
        changes.instanceCount = value.instanceCount || 1;
        hasChanged = true;
      }
      if (formApi.getFieldMeta("cpuLimitMillicores")?.isDefaultValue === false) {
        changes.cpuLimitMillicores =
          value.cpuLimitMillicores === cpuLimits.unlimited ? -1 : value.cpuLimitMillicores;
        hasChanged = true;
      }
      if (formApi.getFieldMeta("memoryLimitMb")?.isDefaultValue === false) {
        changes.memoryLimitMb =
          value.memoryLimitMb === memoryLimits.unlimited ? -1 : value.memoryLimitMb;
        hasChanged = true;
      }

      if (hasChanged) {
        await updateService(changes);
      } else {
        form.reset();
      }
    },
  });

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.fieldMeta.instanceCount?.isDefaultValue === false) count++;
    if (s.fieldMeta.cpuLimitMillicores?.isDefaultValue === false) count++;
    if (s.fieldMeta.memoryLimitMb?.isDefaultValue === false) count++;
    return count;
  });

  return (
    <SettingsSection
      asElement="form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit(e);
      }}
      title="Deploy"
      id="deploy"
      Icon={RocketIcon}
      changeCount={changeCount}
      onClickResetChanges={() => {
        form.reset();
        resetUpdate();
      }}
      SubmitButton={form.SubmitButton}
      isPending={isPendingUpdate}
      error={errorUpdate?.message}
      entityId={sectionHighlightId}
    >
      <Block>
        <form.AppField
          name="instanceCount"
          children={(field) => (
            <BlockItem className="group/item w-full md:w-full">
              <BlockItemHeader className="group-data-changed/item:text-process" type="column">
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                  Instances
                </BlockItemTitle>
                <BlockItemDescription>
                  The number of instances/replicas to run for this service.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <div className="flex w-full flex-col rounded-lg border pb-1.5">
                  <ValueTitle
                    title="Instances"
                    value={field.state.value ? field.state.value.toString() : "1"}
                    hasChanges={!field.state.meta.isDefaultValue}
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
          )}
        />
      </Block>
      <Block>
        <form.Subscribe
          selector={(s) => ({
            hasChanges:
              s.fieldMeta.cpuLimitMillicores?.isDefaultValue === false ||
              s.fieldMeta.memoryLimitMb?.isDefaultValue === false,
          })}
          children={({ hasChanges }) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={hasChanges}>Resource Limits</BlockItemTitle>
                <BlockItemDescription>
                  The maximum vCPU and memory to allocate for each instance.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <div className="flex w-full flex-col rounded-lg border">
                  <form.AppField
                    name="cpuLimitMillicores"
                    children={(field) => (
                      <div className="flex w-full flex-col pb-1.5">
                        <ValueTitle
                          title="vCPU"
                          value={cpuFormatter(field.state.value)}
                          hasChanges={!field.state.meta.isDefaultValue}
                        />
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
                    name="memoryLimitMb"
                    children={(field) => (
                      <div className="flex w-full flex-col pb-1.5">
                        <ValueTitle
                          title="Memory"
                          value={memoryFormatter(field.state.value)}
                          hasChanges={!field.state.meta.isDefaultValue}
                        />
                        <field.StorageSizeInput
                          field={field}
                          className="w-full px-3.5 py-3"
                          onBlur={field.handleBlur}
                          min={memoryLimits.min}
                          max={memoryLimits.unlimited}
                          step={memoryLimits.step}
                          hideMinMax
                          defaultValue={[
                            service.config.resources?.memory_limits_megabytes ||
                              memoryLimits.unlimited,
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
          )}
        />
      </Block>
    </SettingsSection>
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

function ValueTitle({
  title,
  value,
  hasChanges,
  className,
}: {
  title: string;
  value: string;
  hasChanges?: boolean;
  className?: string;
}) {
  return (
    <p
      data-changed={hasChanges ? true : undefined}
      className={cn(
        "text-muted-foreground data-changed:text-process w-full px-3.5 pt-2.5 pb-1 leading-tight font-medium",
        className,
      )}
    >
      <span className="pr-[0.6ch]">{title}:</span>
      <span className="text-foreground font-mono font-bold">{value}</span>
    </p>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `deploy-${service.id}`;
}
