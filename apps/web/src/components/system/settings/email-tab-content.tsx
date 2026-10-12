"use client";

import { BlockItemButtonLike } from "@/components/block";
import ErrorLine from "@/components/error-line";
import { FormActions, Section, SectionSkeleton } from "@/components/system/settings/section";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import DropdownSelect from "@/components/ui/dropdown-select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import {
  clearEmailSettings,
  emailSettingsQuery,
  queryKeyEmail,
  sendTestEmail,
  TEmailSettings,
  updateEmailSettings,
} from "@/lib/queries/email";
import type { EmailSettings } from "@/lib/server/client.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockIcon, SendIcon, Trash2Icon } from "lucide-react";
import { z } from "zod";

type TProps = {
  className?: string;
};

const encryptionItems = [
  { value: "starttls", label: "STARTTLS (port 587)" },
  { value: "tls", label: "TLS (port 465)" },
  { value: "none", label: "None (port 25)" },
];

const defaultPorts: Record<EmailSettings["encryption"], string> = {
  starttls: "587",
  tls: "465",
  none: "25",
};

export default function EmailTabContent({ className }: TProps) {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(emailSettingsQuery());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeyEmail.settings() });

  if (!data && isPending) {
    return (
      <div className={cn("flex w-full flex-col gap-6", className)}>
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

  const settings = data.data;

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <Section
        title="Outgoing Mail"
        description="Unbind sends invitations and notifications through this SMTP relay. Set up SPF and DKIM for the sending domain at your provider, or messages land in spam."
      >
        <EmailSettingsForm
          key={JSON.stringify(settings.settings ?? null)}
          settings={settings}
          onSaved={invalidate}
        />
      </Section>
      {settings.configured && (
        <Section
          title="Check and Remove"
          description="Send yourself a test message, or remove the relay so Unbind stops sending email."
        >
          <div className="flex w-full flex-col gap-3 md:flex-row">
            <TestEmailButton />
            <RemoveEmailTrigger onRemoved={invalidate} />
          </div>
        </Section>
      )}
    </div>
  );
}

const formSchema = z
  .object({
    host: z.string().min(1, "Host is required."),
    port: z
      .string()
      .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 65535, {
        message: "Port must be between 1 and 65535.",
      }),
    encryption: z.enum(["starttls", "tls", "none"]),
    username: z.string(),
    password: z.string(),
    from_address: z.string().email("Enter a valid email address."),
    from_name: z.string(),
  })
  .strip();

function EmailSettingsForm({
  settings,
  onSaved,
}: {
  settings: TEmailSettings;
  onSaved: () => Promise<void>;
}) {
  const { mutateAsync: update, error } = useMutation({ mutationFn: updateEmailSettings });
  const current = settings.settings;

  const defaultValues = {
    host: current?.host ?? "",
    port: String(current?.port ?? 587),
    encryption: current?.encryption ?? ("starttls" as EmailSettings["encryption"]),
    username: current?.username ?? "",
    password: "",
    from_address: current?.from_address ?? "",
    from_name: current?.from_name ?? "",
  };

  const form = useAppForm({
    defaultValues,
    validators: { onChange: formSchema },
    onSubmit: async ({ value }) => {
      await update({
        host: value.host,
        port: Number(value.port),
        encryption: value.encryption,
        username: value.username,
        from_address: value.from_address,
        from_name: value.from_name,
        ...(value.password ? { password: value.password } : {}),
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
        className="flex w-full flex-col gap-3"
      >
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-start">
          <form.AppField
            name="host"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="SMTP Host"
                placeholder="smtp.example.com"
                autoComplete="off"
                className="flex-1"
              />
            )}
          />
          <form.AppField
            name="port"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="Port"
                type="number"
                inputMode="numeric"
                min={1}
                max={65535}
                className="xl:w-32"
              />
            )}
          />
          <form.AppField
            name="encryption"
            children={(field) => (
              <DropdownSelect
                items={encryptionItems}
                value={field.state.value}
                onChange={(v) => {
                  const encryption = v as EmailSettings["encryption"];
                  const portField = form.getFieldValue("port");
                  if (portField === defaultPorts[field.state.value]) {
                    form.setFieldValue("port", defaultPorts[encryption]);
                  }
                  field.handleChange(encryption);
                }}
                className="flex-1"
              >
                {({ isOpen }) => (
                  <BlockItemButtonLike
                    asElement="button"
                    text={encryptionItems.find((i) => i.value === field.state.value)?.label ?? ""}
                    Icon={({ className }) => <LockIcon className={className} />}
                    open={isOpen}
                    onBlur={field.handleBlur}
                    className="xl:py-3.5"
                  />
                )}
              </DropdownSelect>
            )}
          />
        </div>
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-start">
          <form.AppField
            name="username"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="Username"
                placeholder="Leave blank for no authentication"
                autoComplete="off"
                className="flex-1"
              />
            )}
          />
          <form.AppField
            name="password"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle={
                  settings.configured ? "Password (blank keeps the stored one)" : "Password"
                }
                type="password"
                placeholder={settings.configured ? "Leave blank to keep the stored password" : ""}
                autoComplete="new-password"
                className="flex-1"
              />
            )}
          />
        </div>
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-start">
          <form.AppField
            name="from_address"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="From Address"
                type="email"
                placeholder="unbind@example.com"
                autoComplete="off"
                className="flex-1"
              />
            )}
          />
          <form.AppField
            name="from_name"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="From Name"
                placeholder="Unbind"
                autoComplete="off"
                className="flex-1"
              />
            )}
          />
          <form.Subscribe
            selector={(state) => ({ isSubmitting: state.isSubmitting, values: state.values })}
            children={({ isSubmitting, values }) => (
              <FormActions
                isSubmitting={isSubmitting}
                isUnchanged={JSON.stringify(values) === JSON.stringify(defaultValues)}
                onUndo={() => form.reset()}
              />
            )}
          />
        </div>
      </form>
      {error && <ErrorLine message={error.message} />}
    </div>
  );
}

function TestEmailButton() {
  const { mutate: send, isPending } = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: () => {
      toast.add({ type: "success", title: "Test email sent", description: "Check your inbox." });
    },
    onError: (error) => {
      toast.add({ type: "error", title: "Test email failed", description: error.message });
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      isPending={isPending}
      onClick={() => send()}
      className="gap-1.5 xl:py-3.5"
    >
      <SendIcon className="-ml-0.5 size-4.5 shrink-0" />
      <p className="min-w-0 shrink">Send Test Email</p>
    </Button>
  );
}

function RemoveEmailTrigger({ onRemoved }: { onRemoved: () => Promise<void> }) {
  const {
    mutateAsync: remove,
    error,
    reset,
  } = useMutation({
    mutationFn: clearEmailSettings,
    onSuccess: onRemoved,
  });

  return (
    <DeleteEntityTrigger
      dialogTitle="Remove Outgoing Mail"
      dialogDescription="Unbind stops sending invitations and notifications. Invitation links keep working and can be shared by hand."
      deletingEntityName="outgoing mail"
      disableConfirmationInput
      submitButtonText="Remove"
      error={error}
      onDialogClose={reset}
      onSubmit={async () => {
        await remove();
      }}
    >
      <Button type="button" variant="outline" className="text-destructive gap-1.5 xl:py-3.5">
        <Trash2Icon className="-ml-0.5 size-4.5 shrink-0" />
        <p className="min-w-0 shrink">Remove</p>
      </Button>
    </DeleteEntityTrigger>
  );
}
