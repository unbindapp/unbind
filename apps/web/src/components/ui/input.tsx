import * as React from "react";

import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";

const inputVariants = cva(
  "flex px-3 font-medium placeholder:font-medium py-2.5 has-hover:hover:ring-1 has-hover:hover:ring-primary/6-10 data-staged:has-hover:hover:ring-change/7-10 data-staged:has-hover:hover:focus-visible:ring-change/8-10 data-staged:focus-visible:ring-change/8-10 has-hover:hover:focus-visible:ring-primary/8-10 leading-tight w-full rounded-lg border bg-input file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/9-10 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary/8-10 disabled:cursor-not-allowed data-staged:text-change data-staged:bg-change/2-10 data-staged:border-change/5-10 data-staged:placeholder:text-change/8-10",
  {
    variants: {
      variant: {
        default: "",
      },
      fadeOnDisabled: {
        default: "disabled:opacity-50",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      fadeOnDisabled: "default",
    },
  },
);

export type InputProps = React.ComponentPropsWithRef<"input"> &
  VariantProps<typeof inputVariants> &
  InputLayout & {
    Icon?: React.FC<{ className?: string }>;
    classNameIcon?: string;
    showUndo?: boolean;
    onUndo?: () => void;
    hasChanges?: boolean;
  };

type InputLayout =
  | {
      layout: "label-included";
      inputTitle: string;
    }
  | {
      layout?: never;
      inputTitle?: never;
    };

function Input({
  className,
  variant,
  fadeOnDisabled,
  inputTitle,
  layout,
  type,
  Icon,
  hasChanges,
  ...props
}: InputProps) {
  if (layout === "label-included") {
    return (
      <div className={cn("relative", className)}>
        <input
          type={type}
          data-staged={hasChanges || undefined}
          className={cn(
            inputVariants({
              variant,
              fadeOnDisabled,
            }),
            "peer relative pt-5.5 pb-1.5",
            className,
          )}
          {...props}
          placeholder=" "
        />
        <label className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.25 flex w-full origin-top-left -translate-y-[calc(100%-0.1rem)] scale-75 items-center justify-start gap-2 overflow-hidden leading-tight font-medium transition peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-[calc(100%-0.1rem)] peer-focus:scale-75">
          {Icon && <Icon className="size-4.5 shrink-0" />}
          <p className="min-w-0 shrink truncate">{inputTitle}</p>
        </label>
      </div>
    );
  }

  return (
    <input
      type={type}
      data-staged={hasChanges || undefined}
      className={cn(
        inputVariants({
          variant,
          fadeOnDisabled,
          className,
        }),
      )}
      {...props}
    />
  );
}

export { Input };
