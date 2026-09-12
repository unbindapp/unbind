import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

export type TInfoRow = {
  label: string;
  value: ReactNode;
};

export default function InfoRows({ rows, className }: { rows: TInfoRow[]; className?: string }) {
  return (
    <ul className={cn("group/list flex w-full flex-col font-medium", className)}>
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex w-full items-center justify-between gap-6 border-t px-4 py-2.75 first:border-t-0 sm:px-4.5"
        >
          <p className="text-muted-foreground group-data-placeholder/list:bg-muted-foreground group-data-placeholder/list:animate-skeleton min-w-0 shrink truncate leading-tight group-data-placeholder/list:rounded-md group-data-placeholder/list:text-transparent">
            {row.label}
          </p>
          <p className="group-data-placeholder/list:bg-foreground group-data-placeholder/list:animate-skeleton min-w-0 shrink truncate text-right leading-tight group-data-placeholder/list:rounded-md group-data-placeholder/list:text-transparent">
            {row.value}
          </p>
        </li>
      ))}
    </ul>
  );
}
