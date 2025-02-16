import { cva, VariantProps } from "class-variance-authority";
import { TriangleAlertIcon } from "lucide-react";

type Props = {
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
  }
);

export default function ErrorCard({ className, message, variant }: Props) {
  return (
    <div
      data-has-message={message ? true : undefined}
      className={cardVariants({
        variant,
        className,
      })}
    >
      <div className="w-full flex items-center justify-center gap-1.5 px-3 py-4 group-data-[has-message]/card:py-2">
        <TriangleAlertIcon className="size-4 -ml-0.5 shrink-0" />
        <p className="shrink min-w-0 font-medium leading-tight text-left">
          Something went wrong
        </p>
      </div>
      {message && (
        <p className="w-full font-mono text-left rounded-lg text-muted-foreground bg-destructive/4 text-xs px-3 py-2 mt-1">
          {message}
        </p>
      )}
    </div>
  );
}
