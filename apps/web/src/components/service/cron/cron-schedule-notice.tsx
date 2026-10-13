import { cn } from "@/components/ui/utils";
import { InfoIcon } from "lucide-react";

// Tells why a setting is off for a service that runs on a cron schedule
export default function CronScheduleNotice({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-process flex w-full items-start justify-start gap-1.5 px-4 pt-1 pb-1.5 text-sm",
        className,
      )}
    >
      <div className="line-icon h-[0.9lh]">
        <InfoIcon className="-ml-0.5 size-3.5 shrink-0" />
      </div>
      <p className="min-w-0 shrink leading-snug">{children}</p>
    </div>
  );
}
