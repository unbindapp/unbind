import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";
import { TriangleAlertIcon } from "lucide-react";

type TProps = {
  message?: string;
  className?: string;
} & TCardVariants;

export type TCardVariants = VariantProps<typeof cardVariants>;

const cardVariants = cva(
  "w-full select-text group/card rounded-xl flex flex-col items-center p-1.5 gap-1 text-center text-destructive",
  {
    variants: {
      variant: {
        default: "border border-destructive/16 bg-destructive/4",
        "no-bg": "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export default function ErrorCard({ className, message, variant }: TProps) {
  return (
    <div
      data-has-message={message ? true : undefined}
      className={cn(
        cardVariants({
          variant,
          className,
        }),
      )}
    >
      <div className="flex w-full items-center justify-center gap-1.5 px-3 py-4 group-data-has-message/card:py-2">
        <TriangleAlertIcon className="-ml-0.5 size-4 shrink-0" />
        <p className="min-w-0 shrink text-left leading-tight font-medium">Something went wrong</p>
      </div>
      {message && (
        <p className="text-muted-foreground bg-destructive/4 mt-1 w-full rounded-lg px-3 py-2 text-left font-mono text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
