import { Button, buttonVariants, TButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useMounted } from "@/lib/hooks/use-mounted";
import { getRouteApi, useSearch } from "@tanstack/react-router";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import {
  Children,
  cloneElement,
  FC,
  HTMLAttributes,
  isValidElement,
  ReactNode,
  useEffect,
  useState,
} from "react";

export function Block({
  className,
  children,
  ...rest
}: {
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "-mx-2 flex w-[calc(100%+1rem)] flex-col gap-6 md:-mx-2.5 md:w-[calc(100%+1.25rem)] md:flex-row md:flex-wrap md:gap-0",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function BlockItemHeader({
  className,
  children,
  type = "row",
}: {
  className?: string;
  children: ReactNode;
  type?: "row" | "column";
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-start gap-2.5 pb-1.5 pl-1.5",
        type === "column" && "flex-col items-start gap-1 px-1.5 pb-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BlockItemTitle({
  hasChanges,
  className,
  children,
}: {
  hasChanges?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3
      className={cn(
        "min-w-0 shrink leading-tight font-semibold",
        hasChanges && "text-process",
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function BlockItemDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={cn("text-muted-foreground min-w-0 shrink leading-snug", className)}>{children}</p>
  );
}

export function BlockItem({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const childrenArray = Children.toArray(children);
  const Header = childrenArray.find(
    (child) =>
      isValidElement(child) && typeof child.type === "function" && child.type === BlockItemHeader,
  );
  const Content = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "function" &&
      (child.type === BlockItemContent || child.type === BlockItemContentHighlightable),
  );
  return (
    <div className={cn("flex w-full flex-col gap-1 px-2 md:w-1/2 md:px-2.5", className)} {...rest}>
      {Header}
      {Content}
    </div>
  );
}

export function BlockItemContent({
  children,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  if (isValidElement(children)) {
    const childrenProps = (children.props || {}) as { className?: string };
    const { className: restClassName, ...restWithoutClassName } = rest;
    const mergedProps = {
      ...childrenProps,
      ...restWithoutClassName,
    };
    if (childrenProps.className || restClassName) {
      mergedProps.className = cn(childrenProps.className, restClassName);
    }
    return cloneElement(children, mergedProps);
  }
  return children;
}

const routeApi = getRouteApi("__root__");

export function BlockItemContentHighlightable({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const { highlight_id } = routeApi.useSearch();

  useEffect(() => {
    if (highlight_id === id) {
      const timeout = setTimeout(() => {
        setIsHighlighted(true);
        const timeout = setTimeout(() => {
          setIsHighlighted(false);
        }, 3000);
        return () => clearTimeout(timeout);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [highlight_id]);

  return (
    <div
      data-highlight={isHighlighted || undefined}
      id={id}
      className={cn(
        "data-highlight:shadow-block-card-highlight-active shadow-block-card-highlight-idle shadow-success/75 transition-shadow duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

type TBlockItemButtonLikeProps = {
  Icon?: FC<{ className?: string; isEditing?: boolean }>;
  text: string | ReactNode;
  description?: string | FC<{ className?: string }>;
  isPending?: boolean;
  isEditing?: boolean;
  open?: boolean;
  hideChevron?: boolean;
  href?: string;
  classNameText?: string;
  classNameChevron?: string;
  classNameIcon?: string;
  SuffixComponent?: FC<{ className?: string }>;
} & (
  | ({
      asElement: "button";
    } & TButtonProps)
  | ({
      asElement: "div";
    } & React.HTMLAttributes<HTMLDivElement>)
  | ({
      // External link (opens in a new tab) — a plain styled anchor, not a
      // router Link, so it keeps a real `href`.
      asElement: "LinkButton";
    } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "color">)
);

export function BlockItemButtonLike({
  Icon,
  text,
  description: Description,
  open,
  asElement,
  isPending,
  className,
  classNameText,
  classNameChevron,
  classNameIcon,
  hideChevron,
  href,
  SuffixComponent,
  isEditing,
  ...props
}: TBlockItemButtonLikeProps) {
  const isLink = asElement === "LinkButton" && !!href;
  const Element = (asElement === "button" ? Button : isLink ? "a" : "div") as React.ElementType;

  return (
    <Element
      {...(asElement === "button" ? { variant: "outline" } : {})}
      data-open={open || undefined}
      data-pending={isPending || undefined}
      data-editing={isEditing || undefined}
      className={cn(
        // External anchors apply the button styling here since a plain <a> can't
        // take the `variant` prop.
        isLink && buttonVariants({ variant: "outline" }),
        "group/button flex w-full flex-row items-center justify-start gap-2 rounded-lg border px-3 py-2.5 text-left data-pending:text-transparent",
        className,
      )}
      {...(isLink ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      {...(asElement === "button"
        ? { type: "button", disabled: isPending, fadeOnDisabled: !isPending }
        : {})}
      {...props}
    >
      <div className="group-data-pending/button:animate-skeleton flex min-w-0 flex-1 items-start justify-start gap-2">
        {asElement === "LinkButton" && href !== undefined && Icon ? (
          <div
            className={cn(
              "relative size-5 shrink-0 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45",
              classNameIcon,
            )}
          >
            <Icon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
            <ExternalLinkIcon className="absolute top-0 left-0 size-full scale-90 -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
          </div>
        ) : (
          Icon && (
            <Icon
              className={cn(
                "group-data-pending/button:bg-foreground size-5 shrink-0 group-data-pending/button:rounded-full",
                classNameIcon,
              )}
              isEditing={isEditing}
            />
          )
        )}
        <div className="flex w-full min-w-0 shrink flex-col items-start gap-1 overflow-hidden">
          <p
            className={cn(
              "group-data-pending/button:bg-foreground max-w-full min-w-0 truncate leading-tight font-medium select-text group-data-pending/button:rounded-md",
              classNameText,
            )}
          >
            {text}
          </p>
          {typeof Description === "function" ? (
            <Description />
          ) : (
            Description && (
              <p className="text-muted-foreground group-data-pending/button:bg-muted-foreground min-w-0 shrink text-sm leading-tight group-data-pending/button:rounded-md">
                {Description}
              </p>
            )
          )}
        </div>
      </div>
      {!isPending && SuffixComponent && <SuffixComponent className="ml-auto" />}
      {open !== undefined && !hideChevron && !isPending && (
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground -mr-0.75 size-5 transition group-data-open/button:rotate-180",
            classNameChevron,
          )}
        />
      )}
    </Element>
  );
}
