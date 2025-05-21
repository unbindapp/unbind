import { cn } from "@/components/ui/utils";
import { RocketIcon } from "lucide-react";

type TPropsChip = {
  className?: string;
  classNameParagraph?: string;
};

export function ComingSoonChip({ className, classNameParagraph }: TPropsChip) {
  return (
    <div className={cn("bg-background max-w-full rounded-full text-xs leading-tight", className)}>
      <p
        className={cn(
          "bg-warning/12 text-warning border-warning/12 text flex max-w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.25",
          classNameParagraph,
        )}
      >
        Coming Soon
      </p>
    </div>
  );
}

type TPropsCard = {
  className?: string;
};

export function ComingSoonCard({ className }: TPropsCard) {
  return (
    <div className={cn("flex w-full flex-col rounded-lg", className)}>
      <div className="bg-warning/6 border-warning/12 flex w-full flex-col gap-1 rounded-lg border px-4 py-2.5">
        <div className="text-warning flex w-full items-center gap-1.5">
          <RocketIcon className="-ml-0.25 size-4 shrink-0" />
          <p className="flex min-w-0 shrink items-center gap-1 leading-tight font-semibold">
            Coming Soon
          </p>
        </div>
        <p className="text-foreground w-full">
          This feature will be available in an upcoming release.
        </p>
      </div>
    </div>
  );
}
