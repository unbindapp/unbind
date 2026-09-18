"use client";

import {
  accessFieldClassName,
  emptyResourceRow,
  type TResourceCaps,
  type TResourceRow,
} from "@/components/api-key/helpers";
import ResourceRow from "@/components/api-key/resource-row";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import type { TAsyncAndSearchableSelectProps } from "@/lib/hooks/use-app-form";
import { AnyFieldApi, useStore } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import { FC } from "react";

type TProps = {
  field: AnyFieldApi & { AsyncAndSearchableSelect: FC<TAsyncAndSearchableSelectProps> };
  caps: TResourceCaps;
  className?: string;
};

export default function ResourceRows({ field, caps, className }: TProps) {
  const rows = field.state.value as TResourceRow[];
  const { submissionAttempts, message } = useStore(field.form.store, (state) => {
    const errors = state.errors[0]?.rows;
    return {
      submissionAttempts: state.submissionAttempts,
      message: errors && errors.length > 0 ? (errors[0]?.message as string | undefined) : undefined,
    };
  });

  return (
    <div className={cn("mt-2 flex w-full flex-col gap-2", className)}>
      {rows.map((row, index) => (
        <ResourceRow
          index={index}
          key={index}
          field={field}
          row={row}
          onChange={(next) =>
            field.handleChange((prev: TResourceRow[]) =>
              prev.map((r, i) => (i === index ? next : r)),
            )
          }
          onRemove={() => {
            field.handleChange((prev: TResourceRow[]) => prev.filter((_, i) => i !== index));
            caps.remove(index);
          }}
          onCapChange={(cap) => caps.setCap(index, cap)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        className={cn(
          "text-muted-foreground justify-start gap-1.5 px-3 font-semibold",
          // With no rows it stands in for the picker, so it takes the picker's column width
          rows.length === 0 && accessFieldClassName.replace("mt-3", ""),
        )}
        onClick={() => {
          field.handleChange((prev: TResourceRow[]) => [...prev, emptyResourceRow]);
          caps.add();
        }}
      >
        <PlusIcon className="-ml-0.5 size-4.5" />
        <p className="min-w-0 shrink">{rows.length === 0 ? "Add Resource" : "Add Another"}</p>
      </Button>
      {submissionAttempts > 0 && message && (
        <ErrorLine className="bg-transparent px-1 py-0 leading-tight" message={message} />
      )}
    </div>
  );
}
