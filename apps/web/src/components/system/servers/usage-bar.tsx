import { cn } from "@/components/ui/utils";

type TProps = {
  used: number;
  total: number;
  className?: string;
};

export default function UsageBar({ used, total, className }: TProps) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;
  const level = ratio >= 0.9 ? "critical" : ratio >= 0.75 ? "high" : "normal";

  return (
    <div className={cn("bg-border h-1.5 w-full overflow-hidden rounded-full", className)}>
      <div
        data-level={level}
        className="bg-foreground data-[level=critical]:bg-destructive data-[level=high]:bg-warning h-full rounded-full transition-[width]"
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}
