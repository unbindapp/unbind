import { cn } from "@/components/ui/utils";
import { TriangleAlertIcon } from "lucide-react";

type TProps = {
  message?: string;
  className?: string;
  withIcon?: boolean;
};

export default function ErrorLine({ message, withIcon, className }: TProps) {
  const finalMessage = message || "Something went wrong :(";
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full items-center justify-start gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
        className,
      )}
    >
      {withIcon && <TriangleAlertIcon className="-ml-0.5 size-4.5 shrink-0" />}
      <p className="min-w-0 flex-1">{finalMessage}</p>
    </div>
  );
}
