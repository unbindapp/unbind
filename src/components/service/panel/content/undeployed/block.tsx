import { Button, LinkButton, TButtonProps, TLinkButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { Children, cloneElement, FC, HTMLAttributes, isValidElement, ReactNode } from "react";

export function Block({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "-mx-2 flex w-[calc(100%+1rem)] flex-col gap-5 md:-mx-2.5 md:w-[calc(100%+1.25rem)] md:flex-row md:flex-wrap md:gap-0",
        className,
      )}
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
        "flex w-full items-center justify-start gap-2.5 px-2 pb-1.5",
        type === "column" && "flex-col items-start gap-1 pb-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BlockItemTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3 className={cn("min-w-0 shrink leading-tight font-semibold", className)}>{children}</h3>
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
      isValidElement(child) && typeof child.type === "function" && child.type === BlockItemContent,
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

type TBlockItemButtonLikeProps = {
  Icon: FC<{ className?: string }>;
  text: string | ReactNode;
  isPending?: boolean;
  open?: boolean;
  hideChevron?: boolean;
  href?: string;
} & (
  | ({
      asElement: "button";
    } & TButtonProps)
  | ({
      asElement: "div";
    } & React.HTMLAttributes<HTMLDivElement>)
  | ({
      asElement: "LinkButton";
    } & TLinkButtonProps)
);

export function BlockItemButtonLike({
  Icon,
  text,
  open,
  asElement,
  isPending,
  className,
  hideChevron,
  href,
  ...props
}: TBlockItemButtonLikeProps) {
  const Element =
    asElement === "button" ? Button : asElement === "LinkButton" && href ? LinkButton : "div";
  return (
    <Element
      variant="outline"
      data-open={open ? true : undefined}
      data-pending={isPending ? true : undefined}
      className={cn(
        "group/button flex w-full flex-row items-center justify-start gap-2 rounded-lg border px-3 py-2.5 text-left data-pending:text-transparent",
        className,
      )}
      // @ts-expect-error this is fine. Typescript isn't smart enough
      href={href}
      target={href ? "_blank" : undefined}
      {...props}
    >
      <div className="group-data-pending/button:animate-skeleton flex min-w-0 flex-1 items-center justify-start gap-2">
        {asElement === "LinkButton" && href !== undefined ? (
          <div className="relative size-5 shrink-0 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45">
            <Icon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
            <ExternalLinkIcon className="absolute top-0 left-0 size-full scale-90 -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
          </div>
        ) : (
          <Icon className="group-data-pending/button:bg-foreground size-5 shrink-0 group-data-pending/button:rounded-full" />
        )}
        <p className="group-data-pending/button:bg-foreground min-w-0 shrink truncate leading-tight font-medium select-text group-data-pending/button:rounded-md">
          {text}
        </p>
      </div>
      {open !== undefined && !hideChevron && (
        <ChevronDownIcon className="text-muted-foreground -mr-0.75 size-5 transition group-data-open/button:rotate-180" />
      )}
    </Element>
  );
}
