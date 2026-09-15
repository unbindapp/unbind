"use client";

import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { meQuery, updatePassword as updatePasswordFn } from "@/lib/queries/me";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { ReactNode } from "react";
import { z } from "zod";

type TProps = {
  className?: string;
};

export default function GeneralTabContent({ className }: TProps) {
  const { data: me } = useQuery(meQuery);

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <Section title="Email" description="The address you sign in with. It cannot be changed yet.">
        <div className="flex w-full items-start gap-2 md:max-w-md">
          <Input
            readOnly
            value={me?.email ?? ""}
            aria-label="Email"
            className="min-w-0 flex-1"
            layout="label-included"
            inputTitle="Email"
          />
          <CopyButton valueToCopy={me?.email} variant="outline" className="rounded-lg" />
        </div>
      </Section>
      <Section
        title="Password"
        description="Changing your password does not sign out other sessions or revoke API keys."
      >
        <PasswordForm />
      </Section>
    </div>
  );
}

const passwordMinLength = 8;

const PasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(passwordMinLength, `Use at least ${passwordMinLength} characters.`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function PasswordForm() {
  const { mutateAsync: updatePassword, error } = useMutation({ mutationFn: updatePasswordFn });

  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: { onChange: PasswordFormSchema },
    onSubmit: async ({ formApi, value }) => {
      await updatePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      });
      formApi.reset();
      toast.add({ type: "success", title: "Password changed" });
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
        <div className="flex w-full flex-col gap-3 md:max-w-md">
          <form.AppField
            name="currentPassword"
            children={(field) => (
              <field.TextField
                field={field}
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="Current Password"
              />
            )}
          />
          <form.AppField
            name="newPassword"
            children={(field) => (
              <field.TextField
                field={field}
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="New Password"
              />
            )}
          />
          <form.AppField
            name="confirmPassword"
            children={(field) => (
              <field.TextField
                field={field}
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                layout="label-included"
                inputTitle="Confirm New Password"
              />
            )}
          />
        </div>
        <form.Subscribe
          selector={(state) => ({ isSubmitting: state.isSubmitting, values: state.values })}
          children={({ isSubmitting, values }) => {
            const isEmpty =
              values.currentPassword === "" &&
              values.newPassword === "" &&
              values.confirmPassword === "";
            return (
              <div className="flex w-full flex-row gap-3 md:w-auto">
                <form.SubmitButton
                  data-submitting={isSubmitting || undefined}
                  className="group/button flex-1 md:flex-none"
                  disabled={isEmpty}
                >
                  <div className="-ml-0.5 size-4.5 shrink-0">
                    {isSubmitting ? (
                      <LoaderIcon className="size-full animate-spin" />
                    ) : (
                      <SaveIcon className="size-full" />
                    )}
                  </div>
                  <p className="min-w-0 shrink">Change Password</p>
                </form.SubmitButton>
                <Button
                  type="button"
                  disabled={isEmpty}
                  onClick={() => form.reset()}
                  variant="outline"
                  className="gap-1.5"
                >
                  <RotateCcwIcon
                    data-unchanged={isEmpty || undefined}
                    className="-ml-0.5 size-4.5 shrink-0 transition-transform data-unchanged:-rotate-90"
                  />
                  <p className="min-w-0">Undo</p>
                </Button>
              </div>
            );
          }}
        />
      </form>
      {error && <ErrorLine message={error.message} />}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-1 px-1">
        <h3 className="leading-tight font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}
