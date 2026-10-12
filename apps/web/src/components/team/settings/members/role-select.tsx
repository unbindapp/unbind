"use client";

import { roleOptions } from "@/components/api-key/helpers";
import { Button } from "@/components/ui/button";
import DropdownSelect from "@/components/ui/dropdown-select";
import { cn } from "@/components/ui/utils";
import type { PermittedAction } from "@/lib/server/client.gen";
import { ChevronDownIcon } from "lucide-react";

type TProps = {
  value: PermittedAction;
  onChange: (role: PermittedAction) => void;
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
};

export function roleTitle(role: PermittedAction) {
  return roleOptions.find((o) => o.value === role)?.title ?? role;
}

export default function RoleSelect({ value, onChange, disabled, isPending, className }: TProps) {
  return (
    <DropdownSelect
      items={roleOptions.map((o) => ({ value: o.value, label: o.title }))}
      value={value}
      onChange={(v) => onChange(v as PermittedAction)}
      disabled={disabled}
      align="end"
      classNameContent="w-44"
      ItemIcon={({ className, value }) => {
        const Icon = roleOptions.find((o) => o.value === value)?.Icon;
        return Icon ? <Icon className={className} /> : null;
      }}
    >
      {({ isOpen }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-open={isOpen || undefined}
          data-pending={isPending || undefined}
          className={cn("group/button gap-1.5 data-pending:opacity-60", className)}
        >
          <p className="min-w-0 shrink leading-tight">{roleTitle(value)}</p>
          <ChevronDownIcon className="-mr-1 size-4 transition-transform group-data-open/button:rotate-180" />
        </Button>
      )}
    </DropdownSelect>
  );
}
