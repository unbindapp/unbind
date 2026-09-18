"use client";

import { roleOptions } from "@/components/api-key/helpers";
import { BlockItemButtonLike } from "@/components/block";
import type { TAsyncDropdownMenuProps } from "@/lib/hooks/use-app-form";
import type { PermittedAction } from "@/lib/server/client.gen";
import { AnyFieldApi } from "@tanstack/react-form";
import { FC } from "react";

type TProps = {
  field: AnyFieldApi;
  isAllowed: (role: PermittedAction) => boolean;
  className?: string;
};

export default function RoleField({ field, isAllowed, className }: TProps) {
  const Dropdown = (field as AnyFieldApi & { AsyncDropdownMenu: FC<TAsyncDropdownMenuProps> })
    .AsyncDropdownMenu;
  const selected = roleOptions.find((o) => o.value === field.state.value);
  return (
    <Dropdown
      field={field}
      className={className}
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
      classNameItem={({ value }) => (isAllowed(value as PermittedAction) ? "" : "opacity-50")}
      isPending={false}
      error={undefined}
    >
      {({ isOpen }) => (
        <BlockItemButtonLike
          asElement="button"
          text={selected?.title ?? ""}
          Icon={({ className }) => (selected ? <selected.Icon className={className} /> : null)}
          open={isOpen}
          onBlur={field.handleBlur}
        />
      )}
    </Dropdown>
  );
}
