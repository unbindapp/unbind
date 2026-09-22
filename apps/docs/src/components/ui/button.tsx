import { cn } from "@/lib/cn";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const minButtonSizeEnforcerClassName =
  "before:w-full before:h-full before:min-w-[44px] before:min-h-[44px] before:z-[-1] before:bg-transparent before:absolute before:-translate-y-1/2 before:top-1/2 before:-translate-x-1/2 before:left-1/2";

// Trimmed copy of apps/web/src/components/ui/button.tsx. Same rules: every hover state
// is has-hover guarded and paired with an active state, no color transitions.
const buttonVariants = cva(
  "relative group/button focus-visible:z-[1] text-center leading-tight max-w-full select-none z-0 touch-manipulation gap-1.5 rounded-lg font-bold focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary/8-10 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        outline:
          "border border-border bg-background has-hover:hover:bg-border active:bg-border has-hover:hover:text-foreground active:text-foreground",
        ghost:
          "has-hover:hover:bg-border has-hover:hover:text-foreground active:bg-border active:text-foreground",
        card: "bg-card text-foreground has-hover:hover:bg-card-hover active:bg-card-hover",
        input:
          "border bg-input font-medium has-hover:hover:ring-1 has-hover:hover:ring-primary/6-10 active:ring-1 active:ring-primary/6-10 data-popup-open:ring-1 data-popup-open:ring-primary/6-10",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "px-3.5 py-1.25 text-sm rounded-md",
        icon: "size-9 shrink-0 flex items-center justify-center",
      },
      forceMinSize: {
        default: minButtonSizeEnforcerClassName,
        medium:
          "before:w-full before:h-full before:min-w-[36px] before:min-h-[36px] before:z-[-1] before:bg-transparent before:absolute before:-translate-y-1/2 before:top-1/2 before:-translate-x-1/2 before:left-1/2",
        false: "",
      },
      focusVariant: {
        default: "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "input-like": "",
      },
      layout: {
        default: "",
        flex: "inline-flex items-center justify-center",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
      forceMinSize: "default",
      focusVariant: "default",
      layout: "default",
    },
  },
);

export type TButtonVariants = VariantProps<typeof buttonVariants>;

export type TButtonProps = React.ComponentProps<"button"> &
  TButtonVariants & {
    render?: useRender.RenderProp;
  };

function Button({
  className,
  variant,
  size,
  forceMinSize,
  focusVariant,
  render,
  children,
  ...props
}: TButtonProps) {
  const isText = React.Children.toArray(children).every(
    (c) => typeof c === "string" || typeof c === "number",
  );
  return useRender({
    render: render ?? <button />,
    props: {
      className: cn(
        buttonVariants({
          variant,
          size,
          forceMinSize,
          focusVariant,
          layout: isText ? undefined : "flex",
          className,
        }),
      ),
      children: isText ? <p className="min-w-0 shrink">{children}</p> : children,
      ...props,
    },
  });
}

export { Button, buttonVariants };
