"use client";

import AccessField from "@/components/api-key/access-field";
import ApiKeyCreatedDialog from "@/components/api-key/api-key-created-dialog";
import { useApiKeysUtils } from "@/components/api-key/api-keys-provider";
import {
  accessFieldClassName,
  accessFormShape,
  defaultExpiry,
  emptyResourceRow,
  expiresAtFrom,
  expiryOptions,
  hasPickedResource,
  isRoleAllowed,
  pickResourceMessage,
  rowToResource,
  scopedCapFrom,
  useResourceCaps,
  type TAccess,
  type TExpiryValue,
  type TResourceRow,
} from "@/components/api-key/helpers";
import InputSectionWrapper from "@/components/api-key/input-section-wrapper";
import ResourceRows from "@/components/api-key/resource-rows";
import RoleField from "@/components/api-key/role-field";
import { BlockItemButtonLike } from "@/components/block";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import DropdownSelect from "@/components/ui/dropdown-select";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { createApiKey as createApiKeyFn, type TApiKeyCreated } from "@/lib/queries/api-keys";
import type { PermittedAction } from "@/lib/server/client.gen";
import { useMutation } from "@tanstack/react-query";
import { ClockIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

type TProps = {
  className?: string;
};

const FormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(100, "Keep the name under 100 characters."),
    ...accessFormShape,
    expiry: z.enum(["1d", "7d", "30d", "90d", "1y", "never"]),
  })
  .refine(hasPickedResource, pickResourceMessage);

export default function AddApiKeyForm({ className }: TProps) {
  const { invalidate } = useApiKeysUtils();
  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();
  const [created, setCreated] = useState<TApiKeyCreated | null>(null);
  const caps = useResourceCaps();

  const { mutateAsync: createApiKey } = useMutation({
    mutationFn: createApiKeyFn,
    onSuccess: () => {
      invalidate();
    },
  });

  const form = useAppForm({
    defaultValues: {
      name: "",
      access: "full" as TAccess,
      rows: [emptyResourceRow] as TResourceRow[],
      role: "viewer" as PermittedAction,
      expiry: defaultExpiry as TExpiryValue,
    },
    validators: { onChange: FormSchema },
    onSubmit: async ({ formApi, value }) => {
      const resources =
        value.access === "scoped" ? value.rows.map(rowToResource).filter((r) => r !== null) : [];
      const res = await createApiKey({
        name: value.name.trim(),
        role: value.role,
        full_access: value.access === "full",
        resources,
        expires_at: expiresAtFrom(value.expiry),
      });
      temporarilyAddNewEntity(res.data.id);
      setCreated(res.data);
      formApi.reset();
      caps.reset();
    },
  });

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(e);
        }}
        className={cn("flex w-full flex-col rounded-xl border", className)}
      >
        <div className="flex w-full flex-col px-5 pt-3.5 pb-4.5 sm:px-6 sm:pt-4 sm:pb-6">
          <h2 className="w-full text-lg leading-tight font-semibold lg:w-[calc((100%-0.5rem)/2)]">
            Name
          </h2>
          <p className="text-muted-foreground mt-1.5 leading-tight lg:w-[calc((100%-0.5rem)/2)]">
            Something that tells you where the key is used.
          </p>
          <InputSectionWrapper>
            <form.AppField
              name="name"
              children={(field) => (
                <field.TextField
                  dontCheckUntilSubmit
                  className={accessFieldClassName}
                  field={field}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="CI Pipeline"
                />
              )}
            />
          </InputSectionWrapper>
          <h2 className="mt-6 w-full text-lg leading-tight font-semibold lg:w-[calc((100%-0.5rem)/2)]">
            Access
          </h2>
          <p className="text-muted-foreground mt-1.5 leading-tight lg:w-[calc((100%-0.5rem)/2)]">
            You can narrow down a key's permissions if needed.
          </p>
          <InputSectionWrapper>
            <form.AppField
              name="access"
              children={(field) => <AccessField field={field} className={accessFieldClassName} />}
            />
            <form.Subscribe selector={(state) => ({ access: state.values.access })}>
              {({ access }) =>
                access === "scoped" && (
                  <form.AppField
                    name="rows"
                    children={(field) => <ResourceRows field={field} caps={caps} />}
                  />
                )
              }
            </form.Subscribe>
          </InputSectionWrapper>
          <h2 className="mt-8 w-full text-lg leading-tight font-semibold lg:w-[calc((100%-0.5rem)/2)]">
            Role
          </h2>
          <p className="text-muted-foreground mt-1.5 leading-tight lg:w-[calc((100%-0.5rem)/2)]">
            The most a key can do on the resources above.
          </p>
          <InputSectionWrapper>
            <form.Subscribe
              selector={(state) => ({ access: state.values.access, rows: state.values.rows })}
            >
              {({ access, rows }) => {
                const scopedCap = scopedCapFrom(rows, caps.caps);
                return (
                  <form.AppField
                    name="role"
                    children={(field) => (
                      <RoleField
                        field={field}
                        className={accessFieldClassName}
                        isAllowed={(role) => isRoleAllowed(access, scopedCap, role)}
                      />
                    )}
                  />
                );
              }}
            </form.Subscribe>
          </InputSectionWrapper>
          <h2 className="mt-8 w-full text-lg leading-tight font-semibold lg:w-[calc((100%-0.5rem)/2)]">
            Expires
          </h2>
          <p className="text-muted-foreground mt-1.5 leading-tight lg:w-[calc((100%-0.5rem)/2)]">
            An expired key stops working immediately.
          </p>
          <InputSectionWrapper>
            <form.AppField
              name="expiry"
              children={(field) => (
                <DropdownSelect
                  items={expiryOptions.map((o) => ({ value: o.value, label: o.label }))}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v as TExpiryValue)}
                  className={accessFieldClassName}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={expiryOptions.find((o) => o.value === field.state.value)?.label ?? ""}
                      Icon={({ className }) => <ClockIcon className={className} />}
                      open={isOpen}
                      onBlur={field.handleBlur}
                    />
                  )}
                </DropdownSelect>
              )}
            />
          </InputSectionWrapper>
        </div>
        <div className="bg-card flex w-full items-center justify-end rounded-b-xl border-t p-2 sm:p-2.5">
          <form.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting })}>
            {({ isSubmitting }) => (
              <form.SubmitButton className="px-4" isPending={isSubmitting}>
                Create Key
              </form.SubmitButton>
            )}
          </form.Subscribe>
        </div>
      </form>
      <ApiKeyCreatedDialog created={created} onClose={() => setCreated(null)} />
    </>
  );
}
