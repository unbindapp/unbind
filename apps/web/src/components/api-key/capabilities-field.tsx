"use client";

import { capabilityOptions, isCapabilityAllowed } from "@/components/api-key/helpers";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/utils";
import type { KeyCapability, PermittedAction } from "@/lib/server/client.gen";
import { AnyFieldApi } from "@tanstack/react-form";

type TProps = {
  field: AnyFieldApi;
  role: PermittedAction;
  className?: string;
  isPlaceholder?: boolean;
};

export default function CapabilitiesField({ field, role, className, isPlaceholder }: TProps) {
  const selected: KeyCapability[] = field.state.value;
  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className={cn("bg-input group/field flex w-full flex-col rounded-lg border p-1", className)}
    >
      {capabilityOptions.map((option) => {
        const isAllowed = isCapabilityAllowed(role, option.value);
        const isChecked = isAllowed && selected.includes(option.value);
        return (
          <label
            key={option.value}
            data-disabled={!isAllowed || isPlaceholder || undefined}
            className="has-hover:hover:bg-border active:bg-border flex w-full cursor-pointer items-center gap-2.75 rounded-md px-2.5 py-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:active:bg-transparent data-disabled:has-hover:hover:bg-transparent"
          >
            <Checkbox
              disabled={!isAllowed || isPlaceholder}
              onBlur={field.handleBlur}
              checked={isChecked}
              onCheckedChange={(checked) => {
                field.handleChange((prev: KeyCapability[]) => {
                  const without = prev.filter((c) => c !== option.value);
                  return checked ? [...without, option.value] : without;
                });
              }}
            />
            <option.Icon className="text-muted-foreground size-4.5 shrink-0" />
            <div className="flex min-w-0 shrink flex-col gap-0.5">
              <p className="min-w-0 shrink leading-tight font-medium select-none">{option.title}</p>
              <p className="text-muted-foreground min-w-0 shrink text-sm leading-tight select-none">
                {option.description}
              </p>
            </div>
            {!isAllowed && (
              <p className="bg-border text-muted-foreground ml-auto shrink-0 rounded-sm px-1.5 py-0.5 text-xs leading-tight">
                Needs editor
              </p>
            )}
          </label>
        );
      })}
    </div>
  );
}
