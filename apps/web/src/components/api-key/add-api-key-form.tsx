"use client";

import ApiKeyCreatedDialog from "@/components/api-key/api-key-created-dialog";
import { useApiKeysUtils } from "@/components/api-key/api-keys-provider";
import {
  accessOptions,
  defaultExpiry,
  emptyResourceRow,
  expiresAtFrom,
  expiryOptions,
  roleAllowedBy,
  roleOptions,
  rowToResource,
  type TAccess,
  type TExpiryValue,
  type TResourceRow,
} from "@/components/api-key/helpers";
import ResourceRow from "@/components/api-key/resource-row";
import { BlockItemButtonLike } from "@/components/block";
import ErrorLine from "@/components/error-line";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { Button } from "@/components/ui/button";
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
    expiry: z.enum(["1d", "7d", "30d", "90d", "1y", "never"]),
  })
  .refine((v) => v.access === "full" || v.rows.some((row) => row.teamId !== ""), {
    message: "Pick at least one resource.",
    path: ["rows"],
  });

// Name, access, role and expiry share the picker's column width
const fieldClassName = "mt-3 w-full sm:w-[calc((100%-0.5rem)/2)]";

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
                className={fieldClassName}
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="CI Pipeline"
              />
            )}
          />

          <h2 className="mt-6 w-full text-lg leading-tight font-semibold">Access</h2>
          <p className="text-muted-foreground mt-1.5 leading-tight">
            A key can never do more than you can. Narrow it down to what the key is for.
          </p>
          <form.AppField
            name="access"
            children={(field) => {
              const selected = accessOptions.find((o) => o.value === field.state.value);
              return (
                <field.AsyncDropdownMenu
                  field={field}
                  className={fieldClassName}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v as TAccess)}
                  items={accessOptions}
                  ItemIcon={({ className, value }) => {
                    const Icon = accessOptions.find((o) => o.value === value)?.Icon;
                    return Icon ? <Icon className={className} /> : null;
                  }}
                  isPending={false}
                  error={undefined}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={selected?.label ?? ""}
                      Icon={({ className }) =>
                        selected ? <selected.Icon className={cn(className, "size-4.5")} /> : null
                      }
                      open={isOpen}
                      onBlur={field.handleBlur}
                    />
                  )}
                </field.AsyncDropdownMenu>
              );
            }}
          />
          <form.Subscribe selector={(state) => ({ access: state.values.access })}>
            {({ access }) =>
              access === "scoped" && (
                <form.AppField
                  name="rows"
                  children={(field) => (
                    <div className="mt-2 flex w-full flex-col gap-2">
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
                        className="text-muted-foreground w-full justify-start gap-1.5 px-3"
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
              const isAllowed = (role: PermittedAction) =>
                access === "full" || scopedCap === undefined || roleAllowedBy(role, scopedCap);
              return (
                <form.AppField
                  name="role"
                  children={(field) => {
                    const selected = roleOptions.find((o) => o.value === field.state.value);
                    return (
                      <field.AsyncDropdownMenu
                        field={field}
                        className={fieldClassName}
                        value={field.state.value}
                        onChange={(v) => {
                          if (isAllowed(v as PermittedAction)) {
                            field.handleChange(v as PermittedAction);
                          }
                        }}
                        items={roleOptions.map((o) => ({
                          value: o.value,
                          label: o.title,
                          description: o.description,
                        }))}
                        ItemIcon={({ className, value }) => {
                          const Icon = roleOptions.find((o) => o.value === value)?.Icon;
                          return Icon ? <Icon className={className} /> : null;
                        }}
                        ItemSuffix={({ value }) =>
                          isAllowed(value as PermittedAction) ? null : (
                            <p className="bg-border text-muted-foreground rounded-sm px-1.5 py-0.5 text-xs leading-tight">
                              Above your access
                            </p>
                          )
                        }
                        classNameItem={({ value }) =>
                          isAllowed(value as PermittedAction) ? "" : "opacity-50"
                        }
                        isPending={false}
                        error={undefined}
                      >
                        {({ isOpen }) => (
                          <BlockItemButtonLike
                            asElement="button"
                            text={selected?.title ?? ""}
                            Icon={({ className }) =>
                              selected ? (
                                <selected.Icon className={cn(className, "size-4.5")} />
                              ) : null
                            }
                            open={isOpen}
                            onBlur={field.handleBlur}
                          />
                        )}
                      </field.AsyncDropdownMenu>
                    );
                  }}
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
                className={fieldClassName}
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
