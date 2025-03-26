import * as React from "react";

import { cn } from "@/components/ui/utils";
import { cva, VariantProps } from "class-variance-authority";

const inputVariants = cva(
  "flex px-3 font-medium placeholder:font-medium placeholder:text-foreground/50 py-2.75 leading-tight w-full rounded-lg border bg-input transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary/50 disabled:cursor-not-allowed",
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

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants> &
  InputLayout;

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
  ...props
}: InputProps) {
  if (layout === "label-included") {
    return (
      <div className={cn("relative", className)}>
        <input
          type={type}
          className={cn(
            inputVariants({
              variant,
              fadeOnDisabled,
            }),
            "peer relative pt-5.75 pb-1.75",
            className,
          )}
          {...props}
          placeholder=""
        />
        <label className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.25 origin-top-left -translate-y-[calc(100%-0.25rem)] scale-75 font-medium transition peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-[calc(100%-0.25rem)] peer-focus:scale-75">
          {inputTitle}
        </label>
      </div>
    );
  }

  return (
    <input
      type={type}
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
