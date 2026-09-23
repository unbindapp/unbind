"use client";

import { capabilityOptions } from "@/components/api-key/helpers";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/components/ui/utils";
import type { KeyCapability } from "@/lib/server/client.gen";
import { AnyFieldApi } from "@tanstack/react-form";

type TProps = {
  field: AnyFieldApi;
  className?: string;
  isPlaceholder?: boolean;
};

export default function CapabilitiesField({ field, className, isPlaceholder }: TProps) {
  const selected: KeyCapability[] = field.state.value;
  return (
    <div className={cn("bg-input flex w-full flex-col rounded-lg border p-1", className)}>
      {capabilityOptions.map((option) => (
        <label
          key={option.value}
          data-disabled={isPlaceholder || undefined}
          className="has-hover:hover:bg-border active:bg-border flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2.25 data-disabled:cursor-not-allowed data-disabled:opacity-50"
        >
          <div className="line-icon">
            <Checkbox
              disabled={isPlaceholder}
              onBlur={field.handleBlur}
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) => {
                field.handleChange((prev: KeyCapability[]) => {
                  const without = prev.filter((c) => c !== option.value);
                  return checked ? [...without, option.value] : without;
                });
              }}
            />
          </div>
          <div className="line-icon">
            <option.Icon className="size-4.5" />
          </div>
          <p className="-ml-0.5 min-w-0 shrink pt-[0.05lh] leading-tight font-medium select-none">
            {option.title}
          </p>
        </label>
      ))}
    </div>
  );
}
