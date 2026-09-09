import {
  Block,
  BlockItem,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemContentHighlightable,
  BlockItemTitle,
} from "@/components/block";
import { shouldDeploySectionHaveInstances } from "@/components/service/panel/content/deployed/settings/helpers";
import WatchPathsInput from "@/components/service/panel/content/deployed/settings/sections/watch-paths-input";
import {
  stagedNumber,
  stagedString,
  useResetFormOnStagedChange,
  hasApplying,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import type { TServiceChangeField } from "@/components/staged-changes/types";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { gitWatchPathSuggestionsQuery } from "@/lib/queries/git";
import { TServiceShallow } from "@/lib/queries/services";
import { formatWatchPaths, joinWatchPaths, splitWatchPaths } from "@/lib/watch-paths";
import { useQuery } from "@tanstack/react-query";
import { RocketIcon } from "lucide-react";
import { useMemo, useState } from "react";

type TProps = {
  service: TServiceShallow;
};

export const deploySectionInstanceSliderId = getDeploySectionEntityId("instance_slider");

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

    return <Section service={service} />;
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <Section service={service} />;
  }

  if (service.type === "database") {
    return <Section service={service} />;
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
  max: 32000,
  step: 200,
  unlimited: 32200,
};

// The API takes -1 for unlimited while the sliders use a value past their max
const unlimitedApiValue = -1;

function toSlider(apiValue: number, unlimited: number) {
  return apiValue === unlimitedApiValue ? unlimited : apiValue;
}

function toApi(sliderValue: number, unlimited: number) {
  return sliderValue === unlimited ? unlimitedApiValue : sliderValue;
}

const deployFields: TServiceChangeField[] = [
  "instanceCount",
  "cpuLimitMillicores",
  "memoryLimitMb",
  "watchPaths",
];

function Section({ service }: { service: TServiceShallow }) {
  const hasInstances = shouldDeploySectionHaveInstances(service);
  const sectionHighlightId = useMemo(() => getDeploySectionId(service), [service]);
  const serverInstanceCount = service.config.replicas;
  const serverCpu = service.config.resources?.cpu_limits_millicores || unlimitedApiValue;
  const serverMemory = service.config.resources?.memory_limits_megabytes || unlimitedApiValue;
  const serverWatchPaths = joinWatchPaths(service.config.watch_paths);
  const { staged, stage } = useServiceChanges(service, {
    instanceCount: serverInstanceCount,
    cpuLimitMillicores: serverCpu,
    memoryLimitMb: serverMemory,
    watchPaths: serverWatchPaths,
  });

  const defaultValues = {
    instanceCount: stagedNumber(staged.instanceCount, serverInstanceCount),
    cpuLimitMillicores: toSlider(
      stagedNumber(staged.cpuLimitMillicores, serverCpu),
      cpuLimits.unlimited,
    ),
    memoryLimitMb: toSlider(
      stagedNumber(staged.memoryLimitMb, serverMemory),
      memoryLimits.unlimited,
    ),
    watchPaths: stagedString(staged.watchPaths, serverWatchPaths),
  };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, deployFields);

  return (
    <SettingsSection
      title="Deploy"
      id="deploy"
      Icon={RocketIcon}
      entityId={sectionHighlightId}
      hasChanges={deployFields.some((field) => staged[field] !== undefined)}
      isApplying={hasApplying(staged, deployFields)}
    >
      {hasInstances && (
        <Block>
          <form.AppField
            name="instanceCount"
            children={(field) => (
              <BlockItem className="group/item w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle hasChanges={staged.instanceCount !== undefined}>
                    Replicas
                  </BlockItemTitle>
                  <BlockItemDescription>
                    The number of replicas/instances to run for this service.
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContentHighlightable
                  id={deploySectionInstanceSliderId}
                  className="flex w-full flex-col rounded-lg border pb-1.5"
                >
                  <ValueTitle
                    title="Replicas"
                    value={field.state.value ? field.state.value.toString() : "1"}
                    hasChanges={staged.instanceCount !== undefined}
                  />
                  <field.StorageSizeInput
                    field={field}
                    className="w-full px-3.5 py-3"
                    onBlur={field.handleBlur}
                    min={1}
                    max={10}
                    step={1}
                    hideMinMax
                    defaultValue={[serverInstanceCount]}
                    value={field.state.value ? [field.state.value] : undefined}
                    onValueChange={(value) => {
                      field.handleChange(value[0]);
                    }}
                    onValueCommitted={(value) => {
                      stage({
                        field: "instanceCount",
                        label: "Replicas",
                        value: value[0] || 1,
                        previous: serverInstanceCount,
                      });
                    }}
                  />
                </BlockItemContentHighlightable>
              </BlockItem>
            )}
          />
        </Block>
      )}
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle
              hasChanges={
                staged.cpuLimitMillicores !== undefined || staged.memoryLimitMb !== undefined
              }
            >
              Resource Limits
            </BlockItemTitle>
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
                      hasChanges={staged.cpuLimitMillicores !== undefined}
                    />
                    <field.StorageSizeInput
                      field={field}
                      className="w-full px-3.5 py-3"
                      onBlur={field.handleBlur}
                      min={cpuLimits.min}
                      max={cpuLimits.unlimited}
                      step={cpuLimits.step}
                      hideMinMax
                      defaultValue={[toSlider(serverCpu, cpuLimits.unlimited)]}
                      value={field.state.value ? [field.state.value] : undefined}
                      onValueChange={(value) => {
                        field.handleChange(value[0]);
                      }}
                      onValueCommitted={(value) => {
                        stage({
                          field: "cpuLimitMillicores",
                          label: "vCPU limit",
                          value: toApi(value[0], cpuLimits.unlimited),
                          previous: serverCpu,
                          format: (v) => cpuFormatter(toSlider(v, cpuLimits.unlimited)),
                        });
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
                      hasChanges={staged.memoryLimitMb !== undefined}
                    />
                    <field.StorageSizeInput
                      field={field}
                      className="w-full px-3.5 py-3"
                      onBlur={field.handleBlur}
                      min={memoryLimits.min}
                      max={memoryLimits.unlimited}
                      step={memoryLimits.step}
                      hideMinMax
                      defaultValue={[toSlider(serverMemory, memoryLimits.unlimited)]}
                      value={field.state.value ? [field.state.value] : undefined}
                      onValueChange={(value) => {
                        field.handleChange(value[0]);
                      }}
                      onValueCommitted={(value) => {
                        stage({
                          field: "memoryLimitMb",
                          label: "Memory limit",
                          value: toApi(value[0], memoryLimits.unlimited),
                          previous: serverMemory,
                          format: (v) => memoryFormatter(toSlider(v, memoryLimits.unlimited)),
                        });
                      }}
                    />
                  </div>
                )}
              />
            </div>
          </BlockItemContent>
        </BlockItem>
      </Block>
      {service.type === "github" && (
        <Block>
          <form.AppField
            name="watchPaths"
            children={(field) => (
              <BlockItem className="w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle hasChanges={staged.watchPaths !== undefined}>
                    Watch Paths
                  </BlockItemTitle>
                  <BlockItemDescription>
                    Gitignore-style patterns. A push only deploys when a changed file matches one of
                    them. Start a pattern with ! to exclude matches. Leave empty to deploy on every
                    push.
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContent>
                  <WatchPathsField
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

function WatchPathsField({
  service,
  value,
  onChange,
}: {
  service: TServiceShallow;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const { data, isPending, error } = useQuery({
    ...gitWatchPathSuggestionsQuery({
      installationId: service.github_installation_id ?? 0,
      owner: service.git_repository_owner ?? "",
      repoName: service.git_repository ?? "",
      ref: service.config.git_branch ?? "",
    }),
    enabled: shouldLoad,
  });

  return (
    <WatchPathsInput
      value={value}
      onChange={onChange}
      suggestions={data?.suggestions}
      isPending={isPending}
      error={error?.message}
      isTruncated={data?.truncated === true}
      onOpen={() => setShouldLoad(true)}
    />
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
      data-staged={hasChanges || undefined}
      className={cn(
        "text-muted-foreground data-staged:text-change w-full px-3.5 pt-2.5 pb-1 leading-tight font-medium",
        className,
      )}
    >
      <span className="pr-[0.6ch]">{title}:</span>
      <span className="text-foreground font-mono font-bold">{value}</span>
    </p>
  );
}

function getDeploySectionId(service: TServiceShallow): string {
  return `deploy_${service.id}`;
}

function getDeploySectionEntityId(entity: string): string {
  return `deploy_${entity}`;
}
