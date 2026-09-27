"use client";

import { BlockItemButtonLike } from "@/components/block";
import ErrorLine from "@/components/error-line";
import StorageSizeChip from "@/components/storage-size-chip";
import {
  getRegistryThresholdPercentage,
  getRegistryUsageLevel,
  getRegistryUsagePercentage,
  getRegistryUsedGB,
  getRegistryWarning,
} from "@/components/system/registry/helpers";
import { FormActions, Section, SectionSkeleton } from "@/components/system/settings/section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import DropdownSelect from "@/components/ui/dropdown-select";
import { cn } from "@/components/ui/utils";
import { percentageFormatter } from "@/components/volume/helpers";
import { appLocale, defaultAnimationMs } from "@/lib/constants";
import { formatGB } from "@/lib/helpers/format-gb";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import {
  queryKeySystem,
  registryConfigQuery,
  registryStatsQuery,
  startRegistryCleanup,
  updateRegistry,
} from "@/lib/queries/system";
import type {
  RegistryCacheCleanupRun,
  RegistryCacheConfig,
  RegistryCacheStats,
} from "@/lib/server/client.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheckIcon,
  CircleSlashIcon,
  ClockIcon,
  HourglassIcon,
  LoaderIcon,
  RotateCcwIcon,
  ScalingIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

type TProps = {
  className?: string;
};

const runningPollMs = 5000;

export default function RegistryTabContent({ className }: TProps) {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    ...registryConfigQuery(),
    refetchInterval: (query) => (query.state.data?.data.is_pending_resize ? runningPollMs : false),
  });
  const statsQuery = useQuery({
    ...registryStatsQuery(),
    refetchInterval: (query) =>
      query.state.data?.data.last_cleanup?.status === "running" ||
      configQuery.data?.data.is_pending_resize
        ? runningPollMs
        : false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeySystem.registry() });

  if (!configQuery.data && configQuery.isPending) {
    return (
      <div className={cn("flex w-full flex-col gap-6", className)}>
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  if (!configQuery.data) {
    return (
      <div className={cn("flex w-full flex-col", className)}>
        <ErrorLine withIcon message={configQuery.error?.message} />
      </div>
    );
  }

  const config = configQuery.data.data;

  if (!config.managed) {
    return (
      <div className={cn("flex w-full flex-col gap-6", className)}>
        <Section
          title="External Registry"
          description="Images are pushed to a registry Unbind doesn't run, so its storage and cleanup are managed where it is hosted."
        >
          {null}
        </Section>
      </div>
    );
  }

  const stats = statsQuery.data?.data;

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <Section
        title="Usage"
        description="Images and build caches share one volume. Cleanup deletes old images once usage passes the threshold."
      >
        {stats ? (
          <RegistryUsage stats={stats} />
        ) : statsQuery.isPending ? (
          <div className="bg-muted-foreground animate-skeleton h-10.5 w-full rounded-lg" />
        ) : (
          <ErrorLine message={statsQuery.error?.message} />
        )}
      </Section>
      <Section
        title="Cleanup"
        description="Cleanup keeps images that are deployed, pushed in the last hour, or the newest of their repository. New builds wait while it runs."
      >
        <CleanupStatus
          run={stats?.last_cleanup}
          isPending={!stats && statsQuery.isPending}
          onStarted={invalidate}
        />
      </Section>
      <Section
        title="Cleanup Settings"
        description="Cleanup checks the registry on this schedule and only deletes images when usage is over the threshold."
      >
        <CleanupSettingsForm
          key={`${config.cleanup_threshold_gb}-${config.cleanup_schedule}`}
          config={config}
          onSaved={invalidate}
        />
      </Section>
      <Section
        title="Volume Size"
        description="Grow the volume when cleanup can't get under the threshold. The size can't be reduced."
      >
        <VolumeSizeForm key={config.pvc_capacity_gb} config={config} onSaved={invalidate} />
      </Section>
    </div>
  );
}

function RegistryUsage({ stats }: { stats: RegistryCacheStats }) {
  const usedGB = getRegistryUsedGB(stats);
  const usagePercentage = getRegistryUsagePercentage(stats);
  const thresholdPercentage = getRegistryThresholdPercentage(stats);
  const usageLevel = getRegistryUsageLevel(stats);
  const warning = getRegistryWarning(stats);

  return (
    <div data-usage={usageLevel} className="group/usage flex w-full flex-col gap-2 font-medium">
      <div className="text-muted-foreground flex w-full items-end justify-between px-1.5">
        <p className="max-w-1/2 truncate pr-2">
          Used:{" "}
          <span className="text-foreground group-data-[usage=high]/usage:text-warning group-data-[usage=critical]/usage:text-destructive font-semibold">
            {formatGB(usedGB)}
          </span>
        </p>
        <p className="max-w-1/2 truncate pl-2 text-right">
          Total:{" "}
          <span className="text-foreground font-semibold">{formatGB(stats.pvc_capacity_gb)}</span>
        </p>
      </div>
      <div className="relative flex w-full items-center justify-start overflow-hidden rounded-lg border px-3 py-2.5">
        <div className="absolute top-0 left-0 h-full w-full">
          <div
            style={
              usagePercentage !== undefined
                ? { transform: `scaleX(${Math.ceil(usagePercentage)}%)` }
                : undefined
            }
            className="bg-foreground/3-10 group-data-[usage=high]/usage:bg-warning/3-10 group-data-[usage=critical]/usage:bg-destructive/3-10 h-full w-full origin-left"
          />
        </div>
        {thresholdPercentage !== undefined && (
          <div
            style={{ left: `${thresholdPercentage}%` }}
            className="bg-muted-foreground/50 absolute top-0 h-full w-px"
          />
        )}
        <p className="group-data-[usage=high]/usage:text-warning group-data-[usage=critical]/usage:text-destructive relative min-w-0 truncate leading-tight font-semibold">
          {usagePercentage !== undefined ? `${percentageFormatter(usagePercentage)}%` : "Unknown"}
        </p>
      </div>
      <p className="text-muted-foreground px-1.5 text-sm font-normal">
        Cleanup starts at {formatGB(stats.cleanup_threshold_gb)}.{" "}
        {pluralize(stats.image_count, "image")} in{" "}
        {pluralize(stats.repository_count, "repository", "repositories")}.
      </p>
      {warning && (
        <p className="group-data-[usage=high]/usage:text-warning group-data-[usage=critical]/usage:text-destructive text-warning px-1.5 text-sm">
          {warning.title}. {warning.description}
        </p>
      )}
    </div>
  );
}

function CleanupStatus({
  run,
  isPending,
  onStarted,
}: {
  run: RegistryCacheCleanupRun | undefined;
  isPending: boolean;
  onStarted: () => Promise<void>;
}) {
  const isRunning = run?.status === "running";

  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
      {isPending ? (
        <div className="bg-muted-foreground animate-skeleton h-10.5 w-full rounded-lg" />
      ) : (
        <LastCleanup run={run} />
      )}
      <CleanupDialogTrigger onStarted={onStarted}>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || isRunning}
          className="gap-1.5 xl:py-3.5"
        >
          <SparklesIcon className="-ml-0.5 size-4.5 shrink-0" />
          <p className="min-w-0 shrink">Clean Up Now</p>
        </Button>
      </CleanupDialogTrigger>
    </div>
  );
}

function LastCleanup({ run }: { run: RegistryCacheCleanupRun | undefined }) {
  const timestamp = run?.finished_at ?? run?.started_at;
  const { str: timeAgo } = useTimeDifference({
    timestamp: timestamp ? new Date(timestamp).getTime() : undefined,
  });

  if (!run) {
    return (
      <LastCleanupLine Icon={ClockIcon} tone="muted">
        Cleanup hasn&apos;t run yet.
      </LastCleanupLine>
    );
  }

  const trigger = run.manual ? "Started manually" : "Scheduled";
  const meta = timeAgo ? `${trigger}, ${timeAgo}` : trigger;
  const { Icon, tone, text } = describeCleanup(run);

  return (
    <LastCleanupLine Icon={Icon} tone={tone} spin={run.status === "running"} meta={meta}>
      {text}
    </LastCleanupLine>
  );
}

type TCleanupTone = "muted" | "success" | "warning" | "destructive";

function describeCleanup(run: RegistryCacheCleanupRun): {
  Icon: typeof ClockIcon;
  tone: TCleanupTone;
  text: string;
} {
  if (run.status === "running") {
    return { Icon: LoaderIcon, tone: "muted", text: "Cleaning up" };
  }

  if (run.status === "failed") {
    return {
      Icon: TriangleAlertIcon,
      tone: "destructive",
      text: run.result?.error ? `Failed: ${run.result.error}` : "Failed",
    };
  }

  const result = run.result;
  const freed = result ? `Freed ${formatBytes(result.freed_bytes)}` : "";
  const deleted = result ? pluralize(result.deleted_images, "image") : "";

  switch (result?.outcome) {
    case "under_threshold":
      return {
        Icon: CircleCheckIcon,
        tone: "success",
        text: "Under the threshold, nothing to delete",
      };
    case "cleaned":
      return { Icon: CircleCheckIcon, tone: "success", text: `${freed} by deleting ${deleted}` };
    case "over_threshold":
      return {
        Icon: TriangleAlertIcon,
        tone: "destructive",
        text: `${freed} by deleting ${deleted}, still over the threshold`,
      };
    case "skipped":
      return {
        Icon: CircleSlashIcon,
        tone: "warning",
        text: "Skipped, builds or another cleanup kept running",
      };
  }
  return { Icon: CircleCheckIcon, tone: "success", text: "Finished" };
}

function LastCleanupLine({
  Icon,
  tone,
  spin,
  meta,
  children,
}: {
  Icon: typeof ClockIcon;
  tone: TCleanupTone;
  spin?: boolean;
  meta?: string;
  children: string;
}) {
  return (
    <div
      data-tone={tone}
      className="group/line flex min-w-0 flex-1 items-start gap-2 rounded-lg border px-3 py-2.5 leading-tight"
    >
      <div className="line-icon text-muted-foreground group-data-[tone=destructive]/line:text-destructive group-data-[tone=success]/line:text-success group-data-[tone=warning]/line:text-warning">
        <Icon className={cn("-ml-0.5 size-4 shrink-0", spin && "animate-spin")} />
      </div>
      <p className="min-w-0 flex-1 font-medium wrap-break-word">{children}</p>
      {meta && <p className="text-muted-foreground shrink-0 text-sm">{meta}</p>}
    </div>
  );
}

function CleanupDialogTrigger({
  onStarted,
  children,
}: {
  onStarted: () => Promise<void>;
  children: React.ReactElement;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    mutate: startCleanup,
    isPending,
    error,
    reset,
  } = useMutation({
    mutationFn: startRegistryCleanup,
    onSuccess: async () => {
      await onStarted();
      setIsOpen(false);
    },
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) reset();
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent hideXButton className="w-lg max-w-full">
        <DialogHeader>
          <DialogTitle>Clean Up Registry</DialogTitle>
          <DialogDescription>
            Deletes every image that isn&apos;t deployed, pushed in the last hour, or the newest of
            its repository, even under the threshold. Redeploying a deleted image rebuilds it. New
            builds wait until cleanup finishes.
          </DialogDescription>
        </DialogHeader>
        {error && <ErrorLine message={error.message} />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose
            className="text-muted-foreground"
            render={
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            }
          />
          <Button type="button" isPending={isPending} onClick={() => startCleanup()}>
            Clean Up
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const schedulePresets = [
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 3 * * *", label: "Every day at 03:00 UTC" },
];

function scheduleItems(current: string) {
  if (schedulePresets.some((preset) => preset.value === current)) return schedulePresets;
  return [...schedulePresets, { value: current, label: `Custom: ${current}` }];
}

function CleanupSettingsForm({
  config,
  onSaved,
}: {
  config: RegistryCacheConfig;
  onSaved: () => Promise<void>;
}) {
  const { mutateAsync: update, error } = useMutation({ mutationFn: updateRegistry });

  const defaultValues = {
    thresholdGB: String(roundGB(config.cleanup_threshold_gb)),
    schedule: config.cleanup_schedule,
  };
  const items = scheduleItems(config.cleanup_schedule);
  const maxThresholdGB = roundGB(config.pvc_capacity_gb);

  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: z
        .object({
          thresholdGB: z
            .string()
            .refine(
              (v) => Number(v) >= 1 && Number(v) < maxThresholdGB,
              `Must be at least 1 GB and less than the volume size (${formatGB(maxThresholdGB)}).`,
            ),
          schedule: z.string().min(1),
        })
        .strip(),
    },
    onSubmit: async ({ value }) => {
      await update({
        cleanup_threshold_gb: Number(value.thresholdGB),
        cleanup_schedule: value.schedule,
      });
      await onSaved();
    },
  });

  return (
    <div className="flex w-full flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(e);
        }}
        className="flex w-full flex-col gap-3 xl:flex-row xl:items-start"
      >
        <form.AppField
          name="thresholdGB"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle="Threshold (GB)"
              type="number"
              inputMode="decimal"
              min={1}
              max={maxThresholdGB}
              className="flex-1"
            />
          )}
        />
        <form.AppField
          name="schedule"
          children={(field) => (
            <DropdownSelect
              items={items}
              value={field.state.value}
              onChange={(v) => field.handleChange(v)}
              className="flex-1"
            >
              {({ isOpen }) => (
                <BlockItemButtonLike
                  asElement="button"
                  text={items.find((item) => item.value === field.state.value)?.label ?? ""}
                  Icon={({ className }) => <ClockIcon className={className} />}
                  open={isOpen}
                  onBlur={field.handleBlur}
                  className="xl:py-3.5"
                />
              )}
            </DropdownSelect>
          )}
        />
        <form.Subscribe
          selector={(state) => ({ isSubmitting: state.isSubmitting, values: state.values })}
          children={({ isSubmitting, values }) => (
            <FormActions
              isSubmitting={isSubmitting}
              isUnchanged={
                values.thresholdGB === defaultValues.thresholdGB &&
                values.schedule === defaultValues.schedule
              }
              onUndo={() => form.reset()}
            />
          )}
        />
      </form>
      {error && <ErrorLine message={error.message} />}
    </div>
  );
}

function VolumeSizeForm({
  config,
  onSaved,
}: {
  config: RegistryCacheConfig;
  onSaved: () => Promise<void>;
}) {
  const minGB = roundGB(config.pvc_capacity_gb);
  const maxGB = Math.max(minGB, config.maximum_storage_gb);
  const stepGB = config.storage_step_gb || 1;

  const form = useAppForm({
    defaultValues: { capacityGB: minGB },
  });

  if (config.is_pending_resize) {
    return (
      <div className="bg-warning/3-10 border-warning/3-10 text-warning flex w-full items-start justify-start gap-2 rounded-lg border px-3.5 py-2.5 leading-tight font-medium">
        <div className="line-icon">
          <HourglassIcon className="animate-hourglass -ml-0.5 size-4 shrink-0" />
        </div>
        <p className="min-w-0 shrink">Expanding the volume. This could take a couple of minutes.</p>
      </div>
    );
  }

  if (!config.can_expand) {
    return (
      <p className="text-muted-foreground px-1 text-sm">
        The volume is {formatGB(minGB)}. Its storage class
        {config.storage_class ? ` (${config.storage_class})` : ""} doesn&apos;t support growing
        volumes.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <form.Subscribe
          selector={(state) => state.values.capacityGB}
          children={(capacityGB) => (
            <p className="px-1.5 font-semibold">
              <span className="pr-[0.6ch]">Size:</span>
              <StorageSizeChip>{formatGB(capacityGB)}</StorageSizeChip>
            </p>
          )}
        />
        <form.AppField
          name="capacityGB"
          children={(field) => (
            <field.StorageSizeInput
              field={field}
              className="w-full px-1.5 py-2.25"
              onBlur={field.handleBlur}
              min={minGB}
              max={maxGB}
              step={stepGB}
              minMaxFormatter={formatGB}
              defaultValue={[minGB]}
              value={[field.state.value]}
              onValueChange={(value) => field.handleChange(value[0])}
            />
          )}
        />
      </div>
      <form.Subscribe
        selector={(state) => state.values.capacityGB}
        children={(capacityGB) => {
          const isUnchanged = capacityGB <= minGB;
          return (
            <div className="flex w-full flex-row gap-3 md:w-auto">
              <ExpandRegistryDialogTrigger newCapacityGB={capacityGB} onExpanded={onSaved}>
                <Button
                  type="button"
                  variant="warning"
                  disabled={isUnchanged}
                  className="flex-1 md:flex-none xl:py-3.5"
                >
                  <ScalingIcon className="-ml-0.5 size-4.5 shrink-0" />
                  <p className="min-w-0 shrink">Expand</p>
                </Button>
              </ExpandRegistryDialogTrigger>
              <Button
                type="button"
                disabled={isUnchanged}
                onClick={() => form.reset()}
                variant="outline"
                className="gap-1.5 xl:py-3.5"
              >
                <RotateCcwIcon
                  data-unchanged={isUnchanged || undefined}
                  className="-ml-0.5 size-4.5 shrink-0 transition-transform data-unchanged:-rotate-90"
                />
                <p className="min-w-0">Undo</p>
              </Button>
            </div>
          );
        }}
      />
    </div>
  );
}

const expandConfirmText = "I want to expand this volume";

function ExpandRegistryDialogTrigger({
  newCapacityGB,
  onExpanded,
  children,
}: {
  newCapacityGB: number;
  onExpanded: () => Promise<void>;
  children: React.ReactElement;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  const {
    mutateAsync: expand,
    error,
    reset,
  } = useMutation({
    mutationFn: updateRegistry,
    onSuccess: async () => {
      await onExpanded();
      setIsOpen(false);
    },
  });

  const form = useAppForm({
    defaultValues: { textToConfirm: "" },
    validators: {
      onChange: z
        .object({
          textToConfirm: z.string().refine((v) => v === expandConfirmText, {
            message: "Please type the correct text to confirm",
          }),
        })
        .strip(),
    },
    onSubmit: async () => {
      await expand({ pvc_capacity_gb: newCapacityGB });
    },
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) return;
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          form.reset();
          reset();
        }, defaultAnimationMs);
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>
            <span className="pr-[0.5ch]">Expand to:</span>
            <span className="text-foreground bg-foreground/2-10 border-foreground/2-10 max-w-full rounded-md border px-1.25 leading-tight font-semibold">
              {formatGB(newCapacityGB)}
            </span>
          </DialogTitle>
          <DialogDescription>
            Proceed with caution:{" "}
            <span className="text-warning font-semibold">
              The volume size can never be reduced!
            </span>{" "}
            Whenever possible, expand the volume in small increments.
            <br />
            <br />
            Type {`"`}
            <span className="text-warning font-semibold select-all">{expandConfirmText}</span>
            {`"`} to confirm.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex w-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit(e);
          }}
        >
          <form.AppField
            name="textToConfirm"
            children={(field) => (
              <field.TextField
                hideError
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full"
                placeholder={expandConfirmText}
              />
            )}
          />
          <div className="mt-4 flex w-full flex-col gap-4">
            {error && <ErrorLine message={error.message} />}
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <DialogClose
                className="text-muted-foreground"
                render={
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                }
              />
              <form.Subscribe
                selector={(s) => ({
                  canSubmit: s.canSubmit,
                  isSubmitting: s.isSubmitting,
                  values: s.values,
                })}
                children={({ canSubmit, isSubmitting, values }) => (
                  <form.SubmitButton
                    isPending={isSubmitting}
                    variant="warning"
                    disabled={!canSubmit || values.textToConfirm !== expandConfirmText}
                  >
                    Expand
                  </form.SubmitButton>
                )}
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function roundGB(value: number) {
  return Math.round(value * 100) / 100;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  return formatGB(bytes / (1024 * 1024 * 1024));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString(appLocale)} ${count === 1 ? singular : plural}`;
}
