import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

export type TInfoRow = {
  label: string;
  value: ReactNode;
};

export default function InfoRows({ rows, className }: { rows: TInfoRow[]; className?: string }) {
  return (
    <ul className={cn("flex w-full flex-col divide-y rounded-lg border font-medium", className)}>
      {rows.map((row) => (
        <li key={row.label} className="flex w-full items-center justify-between gap-4 px-3 py-2">
          <p className="text-muted-foreground min-w-0 shrink truncate">{row.label}</p>
          <p className="min-w-0 shrink truncate text-right font-mono font-semibold">{row.value}</p>
        </li>
      ))}
    </ul>
  );
}
