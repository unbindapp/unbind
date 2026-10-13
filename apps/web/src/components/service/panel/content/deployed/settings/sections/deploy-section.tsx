import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemContentHighlightable,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import { validateCronExpression } from "@/components/service/backups/backup-config";
import CronScheduleNotice from "@/components/service/cron/cron-schedule-notice";
import {
  continuousScheduleValue,
  cronSchedulePresets,
  cronScheduleToPreset,
  customCronScheduleValue,
  formatCronSchedule,
  formatCronTimezone,
} from "@/components/service/cron/cron-schedule";
import {
  shouldServiceSettingsHaveCronSchedule,
  shouldDeploySectionHaveReplicas,
} from "@/components/service/panel/content/deployed/settings/helpers";
import { useSettingsSectionSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import {
  hasApplying,
  stagedNumber,
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { RevertButton } from "@/components/settings/revert-button";
import { settingsIds } from "@/components/settings/settings-ids";
import { SettingsSection } from "@/components/settings/settings-section";
import type { TServiceChangeField } from "@/components/staged-changes/types";
import { cn } from "@/components/ui/utils";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/lib/queries/services";
import { useStore } from "@tanstack/react-form";
import { CalendarClockIcon, GlobeIcon, InfoIcon, LockIcon, RocketIcon } from "lucide-react";
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
  "cronSchedule",
  "cronTimezone",
  "replicaCount",
  "cpuLimitMillicores",
  "memoryLimitMb",
];

const scheduleItems: TCommandItem[] = [
  { value: continuousScheduleValue, label: "Off" },
  ...cronSchedulePresets,
  { value: customCronScheduleValue, label: "Custom" },
];

function scheduleLabel(preset: string) {
  return scheduleItems.find((item) => item.value === preset)?.label ?? "Custom";
}

const timezoneItems: TCommandItem[] = [
  { value: "", label: "UTC" },
  ...Intl.supportedValuesOf("timeZone")
    .filter((zone) => zone !== "UTC")
    .map((zone) => ({ value: zone, label: zone })),
];

function Section({ service }: { service: TServiceShallow }) {
  const { isItemVisible } = useSettingsSectionSearch("deploy");
  const hasReplicas = shouldDeploySectionHaveReplicas(service);
  const hasSchedule = shouldServiceSettingsHaveCronSchedule(service);
  const sectionHighlightId = useMemo(() => getDeploySectionId(service), [service]);
  const serverSchedule = service.config.cron_schedule ?? continuousScheduleValue;
  const serverTimezone = service.config.cron_timezone ?? "";
  const serverReplicaCount = service.config.replicas;
  const serverCpu = service.config.resources?.cpu_limits_millicores || unlimitedApiValue;
  const serverMemory = service.config.resources?.memory_limits_megabytes || unlimitedApiValue;
  const { staged, stage, unstage, revert } = useServiceChanges(service, {
    cronSchedule: serverSchedule,
    cronTimezone: serverTimezone,
    replicaCount: serverReplicaCount,
    cpuLimitMillicores: serverCpu,
    memoryLimitMb: serverMemory,
  });
  const stagedSchedule = stagedString(staged.cronSchedule, serverSchedule);
  const isScheduled = stagedSchedule !== continuousScheduleValue;
  // Replicas can't share a volume, and a schedule runs one job at a time
  const hasVolume = service.config.volumes.length > 0;
  const isReplicaCountLocked = hasVolume || isScheduled;

  const defaultValues = {
    cronScheduleCustom: stagedSchedule,
    cronTimezone: stagedString(staged.cronTimezone, serverTimezone),
    replicaCount: stagedNumber(staged.replicaCount, serverReplicaCount),
    cpuLimitMillicores: toSlider(
      stagedNumber(staged.cpuLimitMillicores, serverCpu),
      cpuLimits.unlimited,
    ),
    memoryLimitMb: toSlider(
      stagedNumber(staged.memoryLimitMb, serverMemory),
      memoryLimits.unlimited,
    ),
  };
  // The preset only picks a schedule, so it stays on custom when the schedule goes back
  const form = useAppForm({
    defaultValues: { ...defaultValues, cronSchedulePreset: cronScheduleToPreset(stagedSchedule) },
  });
  useResetFormOnStagedChange(form, defaultValues, staged, deployFields);
  const values = useStore(form.store, (s) => s.values);
  const schedulePreset = values.cronSchedulePreset;

  const stageSchedule = (cron: string) =>
    stage({
      field: "cronSchedule",
      label: "Cron schedule",
      value: cron,
      previous: serverSchedule,
      format: formatCronSchedule,
    });
  const stageTimezone = (timezone: string) =>
    stage({
      field: "cronTimezone",
      label: "Cron time zone",
      value: timezone,
      previous: serverTimezone,
      format: formatCronTimezone,
    });
  const changed = {
    replicaCount: values.replicaCount !== serverReplicaCount,
    cpuLimitMillicores: values.cpuLimitMillicores !== toSlider(serverCpu, cpuLimits.unlimited),
    memoryLimitMb: values.memoryLimitMb !== toSlider(serverMemory, memoryLimits.unlimited),
  };

  const showSchedule = hasSchedule && isItemVisible(settingsIds.deploy.cronSchedule);
  const showTimezone =
    showSchedule && isScheduled && isItemVisible(settingsIds.deploy.cronTimezone);
  const showReplicas = hasReplicas && isItemVisible(settingsIds.deploy.replicas);
  const showResourceLimits = isItemVisible(settingsIds.deploy.resourceLimits);
  if (!showSchedule && !showReplicas && !showResourceLimits) return null;

  return (
    <SettingsSection
      title="Deploy"
      id="deploy"
      Icon={RocketIcon}
      entityId={sectionHighlightId}
      hasChanges={
        Object.values(changed).some(Boolean) ||
        staged.cronSchedule !== undefined ||
        staged.cronTimezone !== undefined
      }
      isApplying={hasApplying(staged, deployFields)}
      onDiscard={() => unstage(deployFields)}
    >
      {showSchedule && (
        <Block>
          <BlockItem id={settingsIds.deploy.cronSchedule} className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Cron Schedule</BlockItemTitle>
              <BlockItemDescription>
                Run the service on a schedule instead of continuously. On every tick it runs its
                start command and exits.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent className="gap-0">
              <form.AppField
                name="cronSchedulePreset"
                children={(field) => (
                  <field.AsyncDropdownMenu
                    dontCheckUntilSubmit
                    field={field}
                    value={field.state.value}
                    onChange={(v) => {
                      field.handleChange(v);
                      if (v === customCronScheduleValue) {
                        stageSchedule(form.getFieldValue("cronScheduleCustom"));
                        return;
                      }
                      form.setFieldValue("cronScheduleCustom", v);
                      stageSchedule(v);
                    }}
                    items={scheduleItems}
                    isPending={false}
                    error={undefined}
                  >
                    {({ isOpen }) => (
                      <BlockItemButtonLike
                        asElement="button"
                        data-custom={field.state.value === customCronScheduleValue || undefined}
                        className="data-custom:rounded-b-none data-custom:border-b-0"
                        text={scheduleLabel(field.state.value)}
                        Icon={({ className }) => <CalendarClockIcon className={className} />}
                        variant="outline"
                        open={isOpen}
                        onBlur={field.handleBlur}
                        hasChanges={staged.cronSchedule !== undefined}
                      />
                    )}
                  </field.AsyncDropdownMenu>
                )}
              />
              {schedulePreset === customCronScheduleValue && (
                <>
                  <div className="bg-border group-data-staged/wrapper:bg-change/5-10 -mt-1 h-px w-full" />
                  <form.AppField
                    name="cronScheduleCustom"
                    validators={{
                      onChange: ({ value }) => validateCronExpression(value),
                    }}
                    children={(field) => (
                      <field.TextField
                        className="-mt-1"
                        classNameFrame="rounded-t-none border-t-0 font-mono"
                        field={field}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          if (field.state.meta.errors.length > 0) return;
                          stageSchedule(e.target.value);
                        }}
                        placeholder="*/10 * * * *"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                        revertTo={serverSchedule}
                        onRevert={() => revert(field, "cronSchedule", serverSchedule)}
                        hasChanges={staged.cronSchedule !== undefined}
                      />
                    )}
                  />
                </>
              )}
            </BlockItemContent>
          </BlockItem>
          {showTimezone && (
            <form.AppField
              name="cronTimezone"
              children={(field) => (
                <BlockItem id={settingsIds.deploy.cronTimezone} className="w-full md:w-full">
                  <BlockItemHeader type="column">
                    <BlockItemTitle>Time Zone</BlockItemTitle>
                    <BlockItemDescription>Time zone the schedule is read in.</BlockItemDescription>
                  </BlockItemHeader>
                  <BlockItemContent>
                    <field.AsyncAndSearchableSelect
                      dontCheckUntilSubmit
                      field={field}
                      value={field.state.value}
                      onChange={(v) => {
                        field.handleChange(v);
                        stageTimezone(v);
                      }}
                      items={timezoneItems}
                      isPending={false}
                      error={undefined}
                      commandInputPlaceholder="Search time zones..."
                      CommandEmptyText="No time zones found"
                      CommandEmptyIcon={GlobeIcon}
                    >
                      {({ isOpen }) => (
                        <BlockItemButtonLike
                          asElement="button"
                          text={formatCronTimezone(field.state.value)}
                          Icon={({ className }) => <GlobeIcon className={className} />}
                          variant="outline"
                          open={isOpen}
                          onBlur={field.handleBlur}
                          hasChanges={staged.cronTimezone !== undefined}
                        />
                      )}
                    </field.AsyncAndSearchableSelect>
                  </BlockItemContent>
                </BlockItem>
              )}
            />
          )}
        </Block>
      )}
      {showReplicas && (
        <Block>
          <form.AppField
            name="replicaCount"
            children={(field) => (
              <BlockItem id={settingsIds.deploy.replicas} className="group/item w-full md:w-full">
                <BlockItemHeader type="column">
                  <BlockItemTitle>Replicas</BlockItemTitle>
                  <BlockItemDescription>
                    The number of replicas to run for this service.
                  </BlockItemDescription>
                </BlockItemHeader>
                <BlockItemContentHighlightable
                  id={settingsIds.deploy.replicas}
                  className={cn(
                    "flex w-full flex-col overflow-hidden rounded-lg border pb-1.5",
                    changed.replicaCount && "border-change/5-10 bg-change/2-10",
                  )}
                >
                  <ValueTitle
                    title="Replicas"
                    value={
                      isReplicaCountLocked || !field.state.value
                        ? "1"
                        : field.state.value.toString()
                    }
                    hasChanges={changed.replicaCount}
                    onRevert={() => revert(field, "replicaCount", serverReplicaCount)}
                  />
                  <div className="flex w-full items-center gap-3 px-3.5 py-3">
                    {isReplicaCountLocked && (
                      <LockIcon className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <field.StorageSizeInput
                      field={field}
                      className="min-w-0 flex-1"
                      onBlur={field.handleBlur}
                      min={1}
                      max={10}
                      step={1}
                      hideMinMax
                      disabled={isReplicaCountLocked}
                      defaultValue={[serverReplicaCount]}
                      value={
                        isReplicaCountLocked
                          ? [1]
                          : field.state.value
                            ? [field.state.value]
                            : undefined
                      }
                      hasChanges={changed.replicaCount}
                      onValueChange={(value) => {
                        field.handleChange(value[0]);
                      }}
                      onValueCommitted={(value) => {
                        stage({
                          field: "replicaCount",
                          label: "Replicas",
                          value: value[0] || 1,
                          previous: serverReplicaCount,
                        });
                      }}
                    />
                  </div>
                  {isScheduled && (
                    <CronScheduleNotice>
                      Replicas are not available for cron schedules.
                    </CronScheduleNotice>
                  )}
                  {hasVolume && !isScheduled && (
                    <div className="text-process flex w-full items-start justify-start gap-1.5 px-4 pt-1 pb-1.5 text-sm">
                      <div className="line-icon h-[0.9lh]">
                        <InfoIcon className="-ml-0.5 size-3.5 shrink-0" />
                      </div>
                      <p className="min-w-0 shrink leading-snug">
                        Services with a volume can only have a single replica.
                      </p>
                    </div>
                  )}
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
                The maximum vCPU and memory to allocate for each replica.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div
                className={cn(
                  "flex w-full flex-col overflow-hidden rounded-lg border",
                  (changed.cpuLimitMillicores || changed.memoryLimitMb) && "border-change/5-10",
                )}
              >
                <form.AppField
                  name="cpuLimitMillicores"
                  children={(field) => (
                    <div
                      data-staged={changed.cpuLimitMillicores || undefined}
                      className="data-staged:bg-change/2-10 flex w-full flex-col pb-1.5"
                    >
                      <ValueTitle
                        title="vCPU"
                        value={cpuFormatter(field.state.value)}
                        hasChanges={changed.cpuLimitMillicores}
                        onRevert={() =>
                          revert(
                            field,
                            "cpuLimitMillicores",
                            toSlider(serverCpu, cpuLimits.unlimited),
                          )
                        }
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
                        hasChanges={changed.cpuLimitMillicores}
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
                  data-staged={changed.memoryLimitMb || changed.cpuLimitMillicores || undefined}
                  className="bg-border data-staged:bg-change/5-10 h-px w-full"
                />
                <form.AppField
                  name="memoryLimitMb"
                  children={(field) => (
                    <div
                      data-staged={changed.memoryLimitMb || undefined}
                      className="data-staged:bg-change/2-10 flex w-full flex-col pb-1.5"
                    >
                      <ValueTitle
                        title="Memory"
                        value={memoryFormatter(field.state.value)}
                        hasChanges={changed.memoryLimitMb}
                        onRevert={() =>
                          revert(
                            field,
                            "memoryLimitMb",
                            toSlider(serverMemory, memoryLimits.unlimited),
                          )
                        }
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
                        hasChanges={changed.memoryLimitMb}
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
  onRevert,
}: {
  title: string;
  value: string;
  hasChanges: boolean;
  onRevert: () => void;
}) {
  return (
    <div data-staged={hasChanges || undefined} className="group/title flex w-full items-start">
      <p className="text-muted-foreground group-data-staged/title:text-change/9-10 min-w-0 flex-1 px-3.5 pt-2.5 pb-1 leading-tight font-medium">
        <span className="pr-[0.6ch]">{title}:</span>
        <span className="text-foreground group-data-staged/title:text-change font-mono font-bold">
          {value}
        </span>
      </p>
      <RevertButton
        onClick={onRevert}
        isStaged={hasChanges}
        disabled={!hasChanges}
        className="z-1 mt-0.5 mr-0.5 -mb-1 size-8 disabled:opacity-0"
        classNameIcon="size-4"
      />
    </div>
  );
}

function getDeploySectionId(service: TServiceShallow): string {
  return `deploy_${service.id}`;
}
