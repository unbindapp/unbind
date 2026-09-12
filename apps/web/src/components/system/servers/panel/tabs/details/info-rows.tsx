import { cn } from "@/components/ui/utils";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export type TInfoRow = {
  label: string;
  value: ReactNode;
  Icon?: LucideIcon;
  // Rendered behind the row, e.g. the usage bar of a resource
  background?: ReactNode;
  classNameLabel?: string;
  classNameValue?: string;
};

export default function InfoRows({ rows, className }: { rows: TInfoRow[]; className?: string }) {
  return (
    <ul className={cn("group/list flex w-full flex-col font-medium", className)}>
      {rows.map((row) => (
        <li
          key={row.label}
          className="relative flex w-full items-center justify-between gap-6 overflow-hidden border-t px-4 py-2.75 first:border-t-0 sm:px-4.5"
        >
          {row.background}
          <p
            data-icon={row.Icon ? true : undefined}
            className={cn(
              "text-muted-foreground group-data-placeholder/list:bg-muted-foreground group-data-placeholder/list:animate-skeleton relative min-w-0 shrink truncate leading-tight group-data-placeholder/list:rounded-md group-data-placeholder/list:text-transparent data-icon:-ml-0.5",
              row.classNameLabel,
            )}
          >
            {row.Icon && <row.Icon className="mr-2 mb-0.75 inline-block size-4" />}
            {row.label}
          </p>
          <p
            className={cn(
              "group-data-placeholder/list:bg-foreground group-data-placeholder/list:animate-skeleton relative min-w-0 shrink truncate text-right leading-tight group-data-placeholder/list:rounded-md group-data-placeholder/list:text-transparent",
              row.classNameValue,
            )}
          >
            {row.value}
          </p>
        </li>
      ))}
    </ul>
  );
}
