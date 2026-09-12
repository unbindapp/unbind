import { getUsageLevel, getUsagePercentage } from "@/components/system/servers/helpers";
import { cn } from "@/components/ui/utils";
import { LucideIcon } from "lucide-react";

type TProps = {
  used: number;
  total: number;
  totalLabel: string;
  Icon: LucideIcon;
  className?: string;
};

export default function ServerUsageLine({ used, total, totalLabel, Icon, className }: TProps) {
  const percentage = getUsagePercentage({ used, total });

  return (
    <div
      data-usage={getUsageLevel({ used, total })}
      className={cn(
        "group/line bg-background relative w-full overflow-hidden border py-2",
        className,
      )}
    >
      <div className="absolute top-0 left-0 h-full w-full">
        <div
          style={{ transform: `scaleX(${Math.ceil(percentage)}%)` }}
          className="bg-foreground/2-10 group-data-[usage=high]/line:bg-warning/3-10 group-data-[usage=critical]/line:bg-destructive/3-10 h-full w-full origin-left"
        />
      </div>
      <div className="text-muted-foreground group-data-[usage=high]/line:text-warning group-data-[usage=critical]/line:text-destructive relative flex w-full items-center justify-between gap-4 px-4 leading-tight font-medium">
        <div className="flex min-w-0 shrink items-center gap-1.5">
          <Icon className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton size-3.5 shrink-0 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent" />
          <p className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate group-data-placeholder/item:rounded group-data-placeholder/item:text-transparent">
            {totalLabel}
          </p>
        </div>
        <p className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton max-w-[40%] min-w-0 shrink truncate text-right group-data-placeholder/item:rounded group-data-placeholder/item:text-transparent">
          {Math.round(percentage)}%
        </p>
      </div>
    </div>
  );
}
