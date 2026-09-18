"use client";

import { accessOptions, type TAccess } from "@/components/api-key/helpers";
import { BlockItemButtonLike } from "@/components/block";
import type { TAsyncDropdownMenuProps } from "@/lib/hooks/use-app-form";
import { AnyFieldApi } from "@tanstack/react-form";
import { FC } from "react";

type TProps = {
  field: AnyFieldApi;
  className?: string;
};

export default function AccessField({ field, className }: TProps) {
  const Dropdown = (field as AnyFieldApi & { AsyncDropdownMenu: FC<TAsyncDropdownMenuProps> })
    .AsyncDropdownMenu;
  const selected = accessOptions.find((o) => o.value === field.state.value);
  return (
    <Dropdown
      field={field}
      className={className}
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
          Icon={({ className }) => (selected ? <selected.Icon className={className} /> : null)}
          open={isOpen}
          onBlur={field.handleBlur}
        />
      )}
    </Dropdown>
  );
}
