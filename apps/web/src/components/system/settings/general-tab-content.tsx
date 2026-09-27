"use client";

import ErrorLine from "@/components/error-line";
import { FormActions, Section, SectionSkeleton } from "@/components/system/settings/section";
import { useSystem } from "@/components/system/system-provider";
import { cn } from "@/components/ui/utils";
import { isDomain } from "@/lib/helpers/is-domain";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { updateSystemSettings } from "@/lib/queries/system";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";

type TProps = {
  className?: string;
};

export default function GeneralTabContent({ className }: TProps) {
  const { data, isPending, error, refetch } = useSystem();

  if (!data && isPending) {
    return (
      <div className={cn("flex w-full flex-col gap-6", className)}>
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("flex w-full flex-col", className)}>
        <ErrorLine withIcon message={error?.message} />
      </div>
    );
  }

  const settings = data.data.system_settings;

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <Section
        title="Wildcard Domain"
        description={`Services get automatic domains under this domain. Point a wildcard DNS record (*.your-domain.com) at ${data.data.external_ipv4 || "this server"} before saving.`}
      >
        <WildcardDomainForm
          domain={settings.wildcard_domain ?? ""}
          onSaved={async () => {
            await refetch();
          }}
        />
      </Section>
      <Section
        title="Builds"
        description="Replicas is how many build workers run at once. Parallelism is how many build steps each worker runs at the same time."
      >
        <BuildkitForm
          replicas={settings.buildkit_settings?.replicas ?? 1}
          maxParallelism={settings.buildkit_settings?.max_parallelism ?? 1}
          canUpdate={settings.can_update_buildkit}
          onSaved={async () => {
            await refetch();
          }}
        />
      </Section>
    </div>
  );
}

const WildcardDomainFormSchema = z
  .object({
    domain: z
      .string()
      .min(1, "Domain is required.")
      .refine((v) => isDomain(v), "Enter a domain like example.com."),
  })
  .strip();

function WildcardDomainForm({ domain, onSaved }: { domain: string; onSaved: () => Promise<void> }) {
  const { mutateAsync: update, error } = useMutation({ mutationFn: updateSystemSettings });

  const form = useAppForm({
    defaultValues: { domain },
    validators: { onChange: WildcardDomainFormSchema },
    onSubmit: async ({ formApi, value }) => {
      await update({ wildcard_domain: value.domain });
      await onSaved();
      formApi.reset();
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
          name="domain"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle="Wildcard Domain"
              placeholder="example.com"
              className="flex-1"
            />
          )}
        />
        <form.Subscribe
          selector={(state) => ({ isSubmitting: state.isSubmitting, values: state.values })}
          children={({ isSubmitting, values }) => (
            <FormActions
              isSubmitting={isSubmitting}
              isUnchanged={values.domain === domain}
              onUndo={() => form.reset()}
            />
          )}
        />
      </form>
      {error && <ErrorLine message={error.message} />}
    </div>
  );
}

const buildkitMin = 1;
const buildkitMaxReplicas = 10;
const buildkitMaxParallelism = 32;

function integerInRange({ min, max }: { min: number; max: number }) {
  return z
    .string()
    .refine(
      (v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max,
      `Must be a whole number between ${min} and ${max}.`,
    );
}

const BuildkitFormSchema = z
  .object({
    replicas: integerInRange({ min: buildkitMin, max: buildkitMaxReplicas }),
    maxParallelism: integerInRange({ min: buildkitMin, max: buildkitMaxParallelism }),
  })
  .strip();

function BuildkitForm({
  replicas,
  maxParallelism,
  canUpdate,
  onSaved,
}: {
  replicas: number;
  maxParallelism: number;
  canUpdate: boolean;
  onSaved: () => Promise<void>;
}) {
  const { mutateAsync: update, error } = useMutation({ mutationFn: updateSystemSettings });

  const defaultValues = { replicas: String(replicas), maxParallelism: String(maxParallelism) };

  const form = useAppForm({
    defaultValues,
    validators: { onChange: BuildkitFormSchema },
    onSubmit: async ({ formApi, value }) => {
      await update({
        buildkit_settings: {
          replicas: Number(value.replicas),
          max_parallelism: Number(value.maxParallelism),
        },
      });
      await onSaved();
      formApi.reset();
    },
  });

  return (
    <div className="flex w-full flex-col gap-3">
      {!canUpdate && (
        <p className="text-muted-foreground px-1 text-sm">
          The build service is managed outside Unbind, so these settings are read-only.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(e);
        }}
        className="flex w-full flex-col gap-3 xl:flex-row xl:items-start"
      >
        <form.AppField
          name="replicas"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle="Replicas"
              type="number"
              inputMode="numeric"
              min={buildkitMin}
              max={buildkitMaxReplicas}
              disabled={!canUpdate}
              className="flex-1"
            />
          )}
        />
        <form.AppField
          name="maxParallelism"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              layout="label-included"
              inputTitle="Parallelism"
              type="number"
              inputMode="numeric"
              min={buildkitMin}
              max={buildkitMaxParallelism}
              disabled={!canUpdate}
              className="flex-1"
            />
          )}
        />
        <form.Subscribe
          selector={(state) => ({ isSubmitting: state.isSubmitting, values: state.values })}
          children={({ isSubmitting, values }) => (
            <FormActions
              isSubmitting={isSubmitting}
              isUnchanged={
                !canUpdate ||
                (values.replicas === defaultValues.replicas &&
                  values.maxParallelism === defaultValues.maxParallelism)
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
