import useLogViewPreferences, {
  logViewPreferenceKeys,
} from "@/components/logs/use-log-view-preferences";
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
  classNameInner?: string;
} & ComponentProps<"div">;

export default function LogLine({
  logLine,
  className,
  classNameInner,
  ...rest
}: Props) {
  const [viewPreferences] = useLogViewPreferences();
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
        className={cn(
          `px-3 sm:px-4 py-1 w-full flex items-center bg-transparent group-data-[level=warn]/line:bg-warning/10 group-data-[level=error]/line:bg-destructive/10
          group-hover/line:bg-border group-hover/line:group-data-[level=warn]/line:bg-warning/20 group-hover/line:group-data-[level=error]/line:bg-destructive/20`,
          classNameInner
        )}
      >
        <div className="self-stretch flex pr-1.5 shrink-0">
          <div
            className="self-stretch w-0.75 rounded-full bg-muted-more-foreground/50 group-data-[level=warn]/line:bg-warning 
            group-data-[level=error]/line:bg-destructive"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-start md:flex-row gap-0.5 py-0.5">
          <div className="flex items-center justify-start">
            {viewPreferences.includes(logViewPreferenceKeys.timestamp) && (
              <p
                suppressHydrationWarning
                className="pr-4 shrink min-w-0 font-mono text-muted-foreground px-1 w-36 overflow-hidden overflow-ellipsis whitespace-nowrap leading-tight"
              >
                {format(logLine.timestamp, "MMM dd, HH:mm:ss")}
              </p>
            )}
            {viewPreferences.includes(logViewPreferenceKeys.serviceId) && (
              <p
                suppressHydrationWarning
                className="pr-4 shrink min-w-0 font-mono text-muted-foreground px-1 w-24 overflow-hidden overflow-ellipsis whitespace-nowrap leading-tight"
              >
                {logLine.serviceId}
              </p>
            )}
          </div>
          <p
            suppressHydrationWarning
            className="leading-tight px-1 shrink min-w-0"
          >
            {logLine.message}
          </p>
        </div>
      </div>
    </div>
  );
}
