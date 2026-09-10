import { useRender } from "@base-ui/react/use-render";
import { createLink, type LinkComponent } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";

export const minButtonSizeEnforcerClassName =
  "before:w-full before:h-full before:min-w-[44px] before:min-h-[44px] before:z-[-1] before:bg-transparent before:absolute before:-translate-y-1/2 before:top-1/2 before:-translate-x-1/2 before:left-1/2";

const buttonVariants = cva(
  "relative group/button focus-visible:z-[1] text-center leading-tight max-w-full select-none z-0 touch-manipulation gap-1.5 rounded-lg font-bold focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary/8-10 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pending:[&>*:not([data-slot=button-spinner])]:opacity-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground has-hover:hover:bg-primary active:bg-primary",
        destructive:
          "bg-destructive text-destructive-foreground has-hover:hover:bg-destructive active:bg-destructive",
        warning: "bg-warning text-warning-foreground has-hover:hover:bg-warning active:bg-warning",
        success: "bg-success text-success-foreground has-hover:hover:bg-success active:bg-success",
        process: "bg-process text-process-foreground has-hover:hover:bg-process active:bg-process",
        change: "bg-change text-change-foreground has-hover:hover:bg-change active:bg-change",
        outline:
          "border border-border bg-background has-hover:hover:bg-border active:bg-border has-hover:hover:text-foreground active:text-foreground",
        "outline-muted":
          "border border-border bg-background has-hover:hover:bg-card active:bg-card has-hover:hover:text-foreground active:text-foreground",
        "outline-foreground":
          "border border-foreground bg-background has-hover:hover:bg-foreground/3-10 active:bg-foreground/3-10 has-hover:hover:text-foreground active:text-foreground",
        "outline-process":
          "border text-process border-process/6-10 bg-background has-hover:hover:bg-process/3-10 active:bg-process/3-10 has-hover:hover:text-process active:text-process",
        "outline-change":
          "border text-change border-change/6-10 bg-background has-hover:hover:bg-change/3-10 active:bg-change/3-10 has-hover:hover:text-change active:text-change",
        "warning-outline":
          "border border-warning/6-10 bg-background has-hover:hover:bg-warning/3-10 active:bg-warning/3-10 has-hover:hover:border-warning/0 active:border-warning/0 text-warning has-hover:hover:text-warning active:text-warning",
        secondary:
          "bg-secondary text-secondary-foreground has-hover:hover:bg-secondary active:bg-secondary",
        ghost:
          "has-hover:hover:bg-border has-hover:hover:text-foreground active:bg-border active:text-foreground",
        "ghost-destructive":
          "text-destructive has-hover:hover:bg-destructive/4-10 has-hover:hover:text-destructive active:bg-destructive/4-10 active:text-destructive",
        "ghost-warning":
          "text-warning has-hover:hover:bg-warning/4-10 has-hover:hover:text-warning active:bg-warning/4-10 active:text-warning",
        "ghost-warning-foreground":
          "text-foreground has-hover:hover:bg-warning/4-10 has-hover:hover:text-foreground active:bg-warning/4-10 active:text-foreground",
        "ghost-process":
          "text-process has-hover:hover:bg-process/4-10 has-hover:hover:text-process active:bg-process/4-10 active:text-process",
        "ghost-change":
          "text-change has-hover:hover:bg-change/4-10 has-hover:hover:text-change active:bg-change/4-10 active:text-change",
        "ghost-change-foreground":
          "text-foreground has-hover:hover:bg-change/4-10 has-hover:hover:text-foreground active:bg-change/4-10 active:text-foreground",
        "ghost-foreground":
          "text-foreground has-hover:hover:bg-foreground/3-10 has-hover:hover:text-foreground active:bg-foreground/3-10 active:text-foreground",
        card: "bg-card text-foreground has-hover:hover:bg-card-hover active:bg-card-hover",
        link: "text-primary underline-offset-4 has-hover:hover:underline active:underline",
        google: "bg-google text-google-foreground has-hover:hover:bg-google active:bg-google",
        discord: "bg-discord text-discord-foreground has-hover:hover:bg-discord active:bg-discord",
        github: "bg-github text-github-foreground has-hover:hover:bg-github active:bg-github",
        gitlab: "bg-gitlab text-gitlab-foreground has-hover:hover:bg-gitlab active:bg-gitlab",
        ethereum:
          "bg-ethereum text-ethereum-foreground has-hover:hover:bg-ethereum active:bg-ethereum",
        x: "bg-x text-x-foreground has-hover:hover:bg-x active:bg-x",
        email: "bg-email text-email-foreground has-hover:hover:bg-email active:bg-email",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "px-3.5 py-1.25 text-sm rounded-md",
        lg: "px-9 py-2.5",
        icon: "size-9 shrink-0 flex items-center justify-center",
      },
      loadingState: {
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
      loadingState: "default",
      fadeOnDisabled: "default",
      focusVariant: "default",
      forceMinSize: "default",
      layout: "default",
    },
  },
);

const spinnerVariants = cva(
  "pointer-events-none opacity-0 group-data-pending/button:opacity-100 absolute top-1/2 left-1/2 -translate-1/2 animate-spin group-data-submitting/button:opacity-100",
  {
    variants: {
      size: {
        default: "size-5",
        sm: "size-5",
        lg: "size-6",
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
    render?: useRender.RenderProp;
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
  loadingState,
  isPending,
  render,
  spinnerVariants: spinnerVariantProps,
  children,
  ...props
}: TButtonProps) {
  const isText = React.Children.toArray(children).every(
    (c) => typeof c === "string" || typeof c === "number",
  );
  return useRender({
    render: render ?? <button />,
    props: {
      "data-pending": isPending || undefined,
      className: cn(
        buttonVariants({
          variant,
          size,
          loadingState,
          fadeOnDisabled,
          focusVariant,
          forceMinSize,
          layout: isText ? undefined : "flex",
          className,
        }),
      ),
      disabled: loadingState === "loading" || isPending ? true : disabled,
      children: isPending ? (
        <>
          <LoaderIcon
            data-slot="button-spinner"
            className={cn(spinnerVariants(spinnerVariantProps))}
          />
          {isText ? <p className="min-w-0 shrink">{children}</p> : children}
        </>
      ) : isText ? (
        <p className="min-w-0 shrink">{children}</p>
      ) : (
        children
      ),
      ...props,
    },
  });
}

export type TLinkButtonBaseProps = Omit<React.ComponentPropsWithoutRef<"a">, "color"> &
  VariantProps<typeof buttonVariants>;

const LinkButtonBase = React.forwardRef<HTMLAnchorElement, TLinkButtonBaseProps>(
  (
    {
      className,
      variant,
      size,
      loadingState,
      fadeOnDisabled,
      focusVariant,
      forceMinSize,
      children,
      ...props
    },
    ref,
  ) => {
    const isText = React.Children.toArray(children).every(
      (c) => typeof c === "string" || typeof c === "number",
    );
    return (
      <a
        ref={ref}
        className={cn(
          buttonVariants({
            variant,
            size,
            loadingState,
            fadeOnDisabled,
            focusVariant,
            forceMinSize,
            layout: isText ? undefined : "flex",
            className,
          }),
        )}
        {...props}
      >
        {isText ? <p className="min-w-0 shrink">{children}</p> : children}
      </a>
    );
  },
);
LinkButtonBase.displayName = "LinkButtonBase";

const CreatedLinkButton = createLink(LinkButtonBase);

// Router default is `preload: "intent"`, so hover/touch prefetching is automatic.
const LinkButton: LinkComponent<typeof LinkButtonBase> = (props) => (
  <CreatedLinkButton {...props} />
);

export type TLinkButtonProps = React.ComponentProps<typeof LinkButton>;

export { Button, buttonVariants, LinkButton };
