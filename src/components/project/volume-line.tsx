import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { HardDriveIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  volume: TServiceShallow["config"]["volumes"][number];
  index: number;
  className?: string;
};

type TUsageLevel = "low" | "high";

export default function VolumeLine({ volume, index, className }: TProps) {
  const usagePercentage = useMemo(() => {
    if (!volume.used_gb || !volume.size_gb) return 0;
    return Math.min(Math.max(0, Math.ceil((volume.used_gb / volume.size_gb) * 100)), 100);
  }, [volume]);

  const usageLevel: TUsageLevel = useMemo(() => {
    if (usagePercentage >= 85) return "high";
    return "low";
  }, [usagePercentage]);

  return (
    <Button
      variant={"ghost"}
      data-usage={usageLevel}
      key={volume.id}
      className={cn(
        "group/line relative w-full overflow-hidden rounded-none border px-0 py-2",
        className,
      )}
    >
      {volume.used_gb && volume.size_gb && (
        <div className="absolute top-0 left-0 h-full w-full">
          <div
            style={{
              transform: `scaleX(${usagePercentage}%)`,
            }}
            className="bg-border group-data-[usage=high]/line:bg-warning/8 h-full w-full origin-left"
          />
        </div>
      )}
      <div className="text-muted-foreground group-data-[usage=high]/line:text-warning flex w-full items-center justify-between gap-4 px-4">
        <div className="relative flex min-w-0 shrink items-center gap-2">
          <HardDriveIcon className="size-3.5 shrink-0" />
          <p className="min-w-0 shrink truncate leading-tight font-medium">Storage {index + 1}</p>
        </div>
        {volume.used_gb && volume.size_gb && (
          <p className="-mr-1.5 shrink-0 leading-tight font-medium">{usagePercentage}%</p>
        )}
      </div>
    </Button>
  );
}
