import { cn } from "@/components/ui/utils";
import { format } from "date-fns";
import { ComponentProps } from "react";

export type TLogLine = {
  level: "info" | "warn" | "error";
  timestamp: number;
  message: string;
  deploymentId: string;
  serviceId: string;
};

type Props = {
  logLine: TLogLine;
} & ComponentProps<"div">;

export default function LogLine({ logLine, className, ...rest }: Props) {
  return (
    <div
      {...rest}
      suppressHydrationWarning
      data-level={logLine.level}
      className={cn(
        `w-full flex items-stretch text-xs group/line py-px 
        data-[first]:pt-3
        data-[last]:pb-[calc(1rem+var(--safe-area-inset-bottom))] sm:data-[last]:pb-[calc(1.5rem+var(--safe-area-inset-bottom))]`,
        className
      )}
    >
      <div
        className="px-3 sm:px-4 py-1 w-full flex items-stretch bg-transparent group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10
        group-hover/line:bg-border group-hover/line:group-data-[level=warn]/line:bg-warning/20 group-hover/line:group-data-[level=error]/line:bg-destructive/20"
      >
        <div className="self-stretch flex pr-1.5 shrink-0">
          <div
            className="self-stretch w-0.75 rounded-full bg-muted-more-foreground/50 group-data-[level=warn]/line:bg-warning 
            group-data-[level=error]/line:bg-destructive"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-0.5 py-0.5 sm:py-0.5">
          <p
            suppressHydrationWarning
            className="shrink font-mono text-muted-foreground px-1 min-w-[calc(min(50%,9rem))] leading-tight"
          >
            {format(logLine.timestamp, "MMM dd, HH:mm:ss")}
          </p>
          <p
            suppressHydrationWarning
            className="leading-tight px-1 shrink-[2] min-w-0"
          >
            {logLine.message}
          </p>
        </div>
      </div>
    </div>
  );
}
