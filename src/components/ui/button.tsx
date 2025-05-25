"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const minButtonSizeEnforcerClassName =
  "before:w-full before:h-full before:min-w-[44px] before:min-h-[44px] before:z-[-1] before:bg-transparent before:absolute before:-translate-y-1/2 before:top-1/2 before:-translate-x-1/2 before:left-1/2";

const buttonVariants = cva(
  "relative group/button focus-visible:z-[1] text-center leading-tight max-w-full select-none z-0 touch-manipulation gap-1.5 rounded-lg font-bold focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary/50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground has-hover:hover:bg-primary/85 active:bg-primary/85",
        destructive:
          "bg-destructive text-destructive-foreground has-hover:hover:bg-destructive/85 active:bg-destructive/85",
        warning:
          "bg-warning text-warning-foreground has-hover:hover:bg-warning/85 active:bg-warning/85",
        success:
          "bg-success text-success-foreground has-hover:hover:bg-success/85 active:bg-success/85",
        outline:
          "border border-border bg-background has-hover:hover:bg-border active:bg-border has-hover:hover:text-foreground active:text-foreground",
        "outline-muted":
          "border border-border bg-background has-hover:hover:bg-background-hover active:bg-background-hover has-hover:hover:text-foreground active:text-foreground",
        "outline-foreground":
          "border border-foreground bg-background has-hover:hover:bg-foreground/8 active:bg-foreground/8 has-hover:hover:text-foreground active:text-foreground",
        "warning-outline":
          "border border-warning/25 bg-background has-hover:hover:bg-warning/20 active:bg-warning/20 has-hover:hover:border-warning/0 active:border-warning/0 text-warning has-hover:hover:text-warning active:text-warning",
        secondary:
          "bg-secondary text-secondary-foreground has-hover:hover:bg-secondary/85 active:bg-secondary/85",
        ghost:
          "has-hover:hover:bg-border has-hover:hover:text-foreground active:bg-border active:text-foreground",
        "ghost-destructive":
          "text-destructive has-hover:hover:bg-destructive/10 has-hover:hover:text-destructive active:bg-destructive/10 active:text-destructive",
        "ghost-warning":
          "text-warning has-hover:hover:bg-warning/20 has-hover:hover:text-warning active:bg-warning/20 active:text-warning",
        "ghost-foreground":
          "text-foreground has-hover:hover:bg-foreground/8 has-hover:hover:text-foreground active:bg-foreground/8 active:text-foreground",
        link: "text-primary underline-offset-4 has-hover:hover:underline active:underline",
        google: "bg-google text-google-foreground has-hover:hover:bg-google/85 active:bg-google/85",
        discord:
          "bg-discord text-discord-foreground has-hover:hover:bg-discord/85 active:bg-discord/85",
        github: "bg-github text-github-foreground has-hover:hover:bg-github/85 active:bg-github/85",
        gitlab: "bg-gitlab text-gitlab-foreground has-hover:hover:bg-gitlab/85 active:bg-gitlab/85",
        ethereum:
          "bg-ethereum text-ethereum-foreground has-hover:hover:bg-ethereum/85 active:bg-ethereum/85",
        x: "bg-x text-x-foreground has-hover:hover:bg-x/85 active:bg-x/85",
        email: "bg-email text-email-foreground has-hover:hover:bg-email/85 active:bg-email/85",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "px-3.5 py-1.25 text-sm rounded-md",
        lg: "px-9 py-2.5",
        icon: "size-9 shrink-0 flex items-center justify-center",
      },
      state: {
        default: "",
        loading: "opacity-75 disabled:opacity-75",
      },
      fadeOnDisabled: {
        default: "disabled:opacity-50",
        false: "",
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
      variant: "default",
      size: "default",
      state: "default",
      fadeOnDisabled: "default",
      focusVariant: "default",
      forceMinSize: "default",
      layout: "default",
    },
  },
);

const spinnerVariants = cva(
  "pointer-events-none opacity-0 group-data-pending/button:opacity-100 absolute top-1/2 left-1/2 -translate-1/2 animate-spin opacity-0 group-data-submitting/button:opacity-100",
  {
    variants: {
      size: {
        default: "size-6",
        sm: "size-6",
        lg: "size-7",
        icon: "size-5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export type TButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    spinnerVariants?: VariantProps<typeof spinnerVariants>;
  } & {
    asChild?: boolean;
    isPending?: boolean;
  };

export type TButtonVariants = VariantProps<typeof buttonVariants>;

function Button({
  className,
  variant,
  size,
  disabled,
  fadeOnDisabled,
  focusVariant,
  forceMinSize,
  state,
  isPending,
  asChild = false,
  spinnerVariants: spinnerVariantProps,
  children,
  ...props
}: TButtonProps) {
  const Comp = asChild ? Slot : "button";
  const isText = typeof children === "string";
  return (
    <Comp
      data-pending={isPending ? true : undefined}
      className={cn(
        buttonVariants({
          variant,
          size,
          state,
          fadeOnDisabled,
          focusVariant,
          forceMinSize,
          layout: isText ? undefined : "flex",
          className,
        }),
      )}
      disabled={state === "loading" || isPending ? true : disabled}
      {...props}
    >
      {isPending ? (
        <>
          <LoaderIcon className={cn(spinnerVariants(spinnerVariantProps))} />
          <p className="min-w-0 shrink group-data-pending/button:opacity-0">{children}</p>
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export interface TLinkButtonProps
  extends React.ComponentProps<typeof LinkCustom>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function LinkButton({
  className,
  variant,
  size,
  state,
  fadeOnDisabled,
  focusVariant,
  forceMinSize,
  children,
  asChild,
  ...props
}: TLinkButtonProps) {
  const Comp = asChild ? Slot : LinkCustom;
  const isText = typeof children === "string";

  return (
    <Comp
      className={cn(
        buttonVariants({
          variant,
          size,
          state,
          fadeOnDisabled,
          focusVariant,
          forceMinSize,
          layout: isText ? undefined : "flex",
          className,
        }),
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

type TPrefetch = "hover" | false;
type TLinkCustomProps = Omit<React.ComponentProps<typeof Link>, "prefetch"> & {
  prefetch?: TPrefetch;
};

export function LinkCustom({
  onMouseEnter: onMouseEnterProp,
  onTouchStart: onTouchStartProp,
  href,
  prefetch = "hover",
  ...rest
}: TLinkCustomProps) {
  const router = useRouter();

  const onMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      onMouseEnterProp?.(e);
      if (prefetch === "hover") {
        router.prefetch(href.toString());
      }
    },
    [onMouseEnterProp, href, router, prefetch],
  );

  const onTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLAnchorElement>) => {
      onTouchStartProp?.(e);
      if (prefetch === "hover") {
        router.prefetch(href.toString());
      }
    },
    [onTouchStartProp, href, router, prefetch],
  );

  return (
    <Link
      href={href}
      onMouseEnter={onMouseEnter}
      onTouchStart={onTouchStart}
      prefetch={false}
      {...rest}
    />
  );
}

export { Button, buttonVariants, LinkButton };
