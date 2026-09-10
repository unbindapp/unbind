import { useSettingsSectionSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import { settingsIds } from "@/components/settings/settings-ids";
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
import {
  stagedNumber,
  useResetFormOnStagedChange,
  hasApplying,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import type { TServiceChangeField } from "@/components/staged-changes/types";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/lib/queries/services";
import { RocketIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function DeploySection({ service }: TProps) {
  const { isSectionVisible } = useSettingsSectionSearch("deploy");
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
];

function Section({ service }: { service: TServiceShallow }) {
  const { isItemVisible } = useSettingsSectionSearch("deploy");
  const hasInstances = shouldDeploySectionHaveInstances(service);
  const sectionHighlightId = useMemo(() => getDeploySectionId(service), [service]);
  const serverInstanceCount = service.config.replicas;
  const serverCpu = service.config.resources?.cpu_limits_millicores || unlimitedApiValue;
  const serverMemory = service.config.resources?.memory_limits_megabytes || unlimitedApiValue;
  const { staged, stage, unstage } = useServiceChanges(service, {
    instanceCount: serverInstanceCount,
    cpuLimitMillicores: serverCpu,
    memoryLimitMb: serverMemory,
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
  };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, deployFields);

  const showReplicas = hasInstances && isItemVisible(settingsIds.deploy.replicas);
  const showResourceLimits = isItemVisible(settingsIds.deploy.resourceLimits);
  if (!showReplicas && !showResourceLimits) return null;

  return (
    <SettingsSection
      title="Deploy"
      id="deploy"
      Icon={RocketIcon}
      entityId={sectionHighlightId}
      hasChanges={deployFields.some((field) => staged[field] !== undefined)}
      isApplying={hasApplying(staged, deployFields)}
      onDiscard={() => unstage(deployFields)}
    >
      {showReplicas && (
        <Block>
          <form.AppField
            name="instanceCount"
            children={(field) => (
              <BlockItem id={settingsIds.deploy.replicas} className="group/item w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle>Replicas</BlockItemTitle>
                  <BlockItemDescription>
                    The number of replicas/instances to run for this service.
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContentHighlightable
                  id={settingsIds.deploy.replicas}
                  className={cn(
                    "flex w-full flex-col overflow-hidden rounded-lg border pb-1.5",
                    staged.instanceCount !== undefined && "border-change/5-10 bg-change/2-10",
                  )}
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
                    hasChanges={staged.instanceCount !== undefined}
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
      {showResourceLimits && (
        <Block>
          <BlockItem id={settingsIds.deploy.resourceLimits} className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Resource Limits</BlockItemTitle>
              <BlockItemDescription>
                The maximum vCPU and memory to allocate for each instance.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div
                className={cn(
                  "flex w-full flex-col overflow-hidden rounded-lg border",
                  (staged.cpuLimitMillicores !== undefined || staged.memoryLimitMb !== undefined) &&
                    "border-change/5-10",
                )}
              >
                <form.AppField
                  name="cpuLimitMillicores"
                  children={(field) => (
                    <div
                      data-staged={staged.cpuLimitMillicores !== undefined || undefined}
                      className="data-staged:bg-change/2-10 flex w-full flex-col pb-1.5"
                    >
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
                        hasChanges={staged.cpuLimitMillicores !== undefined}
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
                <div
                  data-staged={
                    staged.memoryLimitMb !== undefined || staged.cpuLimitMillicores || undefined
                  }
                  className="bg-border data-staged:bg-change/5-10 h-px w-full"
                />
                <form.AppField
                  name="memoryLimitMb"
                  children={(field) => (
                    <div
                      data-staged={staged.memoryLimitMb !== undefined || undefined}
                      className="data-staged:bg-change/2-10 flex w-full flex-col pb-1.5"
                    >
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
                        hasChanges={staged.memoryLimitMb !== undefined}
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
      )}
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
      data-staged={hasChanges || undefined}
      className={cn(
        "group/title text-muted-foreground data-staged:text-change/9-10 w-full px-3.5 pt-2.5 pb-1 leading-tight font-medium",
        className,
      )}
    >
      <span className="pr-[0.6ch]">{title}:</span>
      <span className="text-foreground group-data-staged/title:text-change font-mono font-bold">
        {value}
      </span>
    </p>
  );
}

function getDeploySectionId(service: TServiceShallow): string {
  return `deploy_${service.id}`;
}
