"use client";

import ApiKeyCreatedDialog from "@/components/api-key/api-key-created-dialog";
import { useApiKeysUtils } from "@/components/api-key/api-keys-provider";
import {
  defaultExpiry,
  emptyResourceRow,
  expiresAtFrom,
  expiryOptions,
  roleAllowedBy,
  roleOptions,
  rowToResource,
  type TExpiryValue,
  type TResourceRow,
} from "@/components/api-key/helpers";
import ResourceRow from "@/components/api-key/resource-row";
import { BlockItemButtonLike } from "@/components/block";
import ErrorLine from "@/components/error-line";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import DropdownSelect from "@/components/ui/dropdown-select";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { createApiKey as createApiKeyFn, type TApiKeyCreated } from "@/lib/queries/api-keys";
import type { PermittedAction } from "@/lib/server/client.gen";
import { useMutation } from "@tanstack/react-query";
import { ClockIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";

type TProps = {
  className?: string;
};

type TAccess = "full" | "scoped";

const accessOptions: { value: TAccess; title: string; description: string }[] = [
  {
    value: "full",
    title: "Everything I can access",
    description: "Follows your own permissions, including changes made later.",
  },
  {
    value: "scoped",
    title: "Only specific resources",
    description:
      "Pick a team, project, environment or service. Each pick includes everything below it.",
  },
];

const FormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(100, "Keep the name under 100 characters."),
    access: z.enum(["full", "scoped"]),
    rows: z.array(
      z.object({
        teamId: z.string(),
        projectId: z.string(),
        environmentId: z.string(),
        serviceId: z.string(),
      }),
    ),
    role: z.enum(["viewer", "editor", "admin"]),
    expiry: z.enum(["7d", "30d", "90d", "1y", "never"]),
  })
  .refine((v) => v.access === "full" || v.rows.some((row) => row.teamId !== ""), {
    message: "Pick at least one resource.",
    path: ["rows"],
  });

export default function AddApiKeyForm({ className }: TProps) {
  const { invalidate } = useApiKeysUtils();
  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();
  const [created, setCreated] = useState<TApiKeyCreated | null>(null);
  // Per row, the strongest role the owner holds on its deepest pick
  const [caps, setCaps] = useState<(PermittedAction | null)[]>([null]);

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
      setCaps([null]);
    },
  });

  const setCap = useCallback((index: number, cap: PermittedAction | null) => {
    setCaps((prev) => {
      if (prev[index] === cap) return prev;
      const next = [...prev];
      next[index] = cap;
      return next;
    });
  }, []);

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
          <h2 className="w-full text-lg leading-tight font-semibold">Name</h2>
          <p className="text-muted-foreground mt-1.5 leading-tight">
            Something that tells you where the key is used.
          </p>
          <form.AppField
            name="name"
            children={(field) => (
              <field.TextField
                dontCheckUntilSubmit
                className="mt-3 w-full md:max-w-md"
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="GitHub Actions deploy"
              />
            )}
          />

          <h2 className="mt-6 w-full text-lg leading-tight font-semibold">Access</h2>
          <p className="text-muted-foreground mt-1.5 leading-tight">
            A key can never do more than you can. Narrow it down to what the key is for.
          </p>
          <form.AppField
            name="access"
            children={(field) => (
              <OptionList>
                {accessOptions.map((option) => (
                  <OptionRow
                    key={option.value}
                    title={option.title}
                    description={option.description}
                    checked={field.state.value === option.value}
                    onCheckedChange={(checked) => {
                      if (checked) field.handleChange(option.value);
                    }}
                    onBlur={field.handleBlur}
                  />
                ))}
              </OptionList>
            )}
          />
          <form.Subscribe selector={(state) => ({ access: state.values.access })}>
            {({ access }) =>
              access === "scoped" && (
                <form.AppField
                  name="rows"
                  children={(field) => (
                    <div className="mt-3 flex w-full flex-col gap-2">
                      {field.state.value.map((row, index) => (
                        <ResourceRow
                          key={index}
                          field={field}
                          row={row}
                          onChange={(next) =>
                            field.handleChange((prev) =>
                              prev.map((r, i) => (i === index ? next : r)),
                            )
                          }
                          onRemove={
                            field.state.value.length > 1
                              ? () => {
                                  field.handleChange((prev) => prev.filter((_, i) => i !== index));
                                  setCaps((prev) => prev.filter((_, i) => i !== index));
                                }
                              : undefined
                          }
                          onCapChange={(cap) => setCap(index, cap)}
                        />
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-muted-foreground -ml-1 gap-1.5 self-start px-3"
                        onClick={() => {
                          field.handleChange((prev) => [...prev, emptyResourceRow]);
                          setCaps((prev) => [...prev, null]);
                        }}
                      >
                        <PlusIcon className="-ml-0.5 size-4.5" />
                        <p className="min-w-0 shrink">Add another</p>
                      </Button>
                    </div>
                  )}
                />
              )
            }
          </form.Subscribe>

          <h2 className="mt-6 w-full text-lg leading-tight font-semibold">Role</h2>
          <p className="text-muted-foreground mt-1.5 leading-tight">
            The most a key can do on the resources above.
          </p>
          <form.Subscribe
            selector={(state) => ({ access: state.values.access, rows: state.values.rows })}
          >
            {({ access, rows }) => {
              const pickedCaps = rows.map((row, i) => (row.teamId ? caps[i] : undefined));
              const scopedCap = pickedCaps.reduce<PermittedAction | null | undefined>(
                (weakest, cap) => {
                  if (cap === undefined) return weakest;
                  if (weakest === undefined) return cap;
                  if (weakest === null || cap === null) return null;
                  return roleAllowedBy(cap, weakest) ? cap : weakest;
                },
                undefined,
              );
              return (
                <form.AppField
                  name="role"
                  children={(field) => (
                    <OptionList>
                      {roleOptions.map((option) => {
                        const disabled =
                          access === "scoped" &&
                          scopedCap !== undefined &&
                          !roleAllowedBy(option.value, scopedCap);
                        return (
                          <OptionRow
                            key={option.value}
                            title={option.title}
                            description={
                              disabled
                                ? "Above what you hold on a picked resource."
                                : option.description
                            }
                            disabled={disabled}
                            checked={field.state.value === option.value}
                            onCheckedChange={(checked) => {
                              if (checked) field.handleChange(option.value);
                            }}
                            onBlur={field.handleBlur}
                          />
                        );
                      })}
                    </OptionList>
                  )}
                />
              );
            }}
          </form.Subscribe>

          <h2 className="mt-6 w-full text-lg leading-tight font-semibold">Expires</h2>
          <p className="text-muted-foreground mt-1.5 leading-tight">
            An expired key stops working on its own. Pick never for long-running automation.
          </p>
          <form.AppField
            name="expiry"
            children={(field) => (
              <DropdownSelect
                items={expiryOptions.map((o) => ({ value: o.value, label: o.label }))}
                value={field.state.value}
                onChange={(v) => field.handleChange(v as TExpiryValue)}
                className="mt-3 w-full md:max-w-xs"
              >
                {({ isOpen }) => (
                  <BlockItemButtonLike
                    asElement="button"
                    text={expiryOptions.find((o) => o.value === field.state.value)?.label ?? ""}
                    Icon={({ className }) => <ClockIcon className={cn(className, "size-4.5")} />}
                    open={isOpen}
                    onBlur={field.handleBlur}
                  />
                )}
              </DropdownSelect>
            )}
          />

          <form.Subscribe
            selector={(state) => ({
              submissionAttempts: state.submissionAttempts,
              allErrors: state.errors,
            })}
            children={({ submissionAttempts, allErrors }) => {
              const errors = allErrors[0]?.rows;
              const message = errors && errors.length > 0 ? errors[0]?.message : undefined;
              if (submissionAttempts > 0 && message) {
                return (
                  <ErrorLine className="mt-4 bg-transparent p-0 leading-tight" message={message} />
                );
              }
            }}
          />
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

function OptionList({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-3 mt-2 flex w-[calc(100%+1.5rem)] flex-col items-start justify-start">
      {children}
    </div>
  );
}

function OptionRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  onBlur,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onBlur: () => void;
}) {
  return (
    <label
      data-disabled={disabled || undefined}
      className="has-hover:hover:bg-border active:bg-border flex w-full cursor-pointer items-start gap-2.75 rounded-md px-3.5 py-2.5 data-disabled:cursor-not-allowed data-disabled:opacity-50"
    >
      <Checkbox
        className="mt-0.5"
        disabled={disabled}
        onBlur={onBlur}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <div className="flex min-w-0 shrink flex-col gap-0.5">
        <p className="leading-tight font-medium select-none">{title}</p>
        <p className="text-muted-foreground text-sm leading-tight select-none">{description}</p>
      </div>
    </label>
  );
}
