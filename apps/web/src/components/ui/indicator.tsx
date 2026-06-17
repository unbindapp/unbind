import { cn } from "@/components/ui/utils";

export default function Indicator({
  isError,
  isPending,
  isRefetching,
  dotClasses,
  className,
  hasData,
  showOnError = "refetch-only",
  showOnIsPending = false,
  showOnIsRefetching = true,
  showOnHasData = false,
}: {
  isError: boolean;
  isPending: boolean;
  isRefetching: boolean;
  hasData?: boolean;
  dotClasses?: string;
  className?: string;
  showOnError?: "refetch-only" | "all";
  showOnSuccess?: boolean;
  showOnIsPending?: boolean;
  showOnIsRefetching?: boolean;
  showOnHasData?: boolean;
}) {
  return (
    <div
      data-has-data={hasData ? true : undefined}
      data-error={isError && !isPending && !isRefetching ? true : undefined}
      data-refetching={isRefetching ? true : undefined}
      data-pending={isPending ? true : undefined}
      className={cn("group/indicator absolute top-0 left-0 z-10 p-1.75", className)}
    >
      <div
        className={cn(
          "group-data-refetching/indicator:animate-pulse-scale size-1.5",
          showOnIsPending && "group-data-pending/indicator:animate-pulse-scale",
        )}
      >
        <div
          className={cn(
            "bg-border size-full scale-0 rounded-full transition",
            showOnHasData &&
              "group-data-has-data/indicator:bg-success group-data-has-data/indicator:scale-100",
            showOnIsRefetching &&
              "group-data-refetching/indicator:bg-border group-data-refetching/indicator:scale-100",
            showOnIsPending &&
              "group-data-pending/indicator:bg-border group-data-pending/indicator:scale-100",
            showOnError === "refetch-only" &&
              hasData &&
              isError &&
              !isRefetching &&
              !isPending &&
              "group-data-error/indicator:bg-destructive group-data-error/indicator:scale-100",
            showOnError === "all" &&
              isError &&
              !isRefetching &&
              !isPending &&
              "group-data-error/indicator:bg-destructive group-data-error/indicator:scale-100",
            dotClasses,
          )}
        />
      </div>
    </div>
  );
}
