import { Button, TButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ChevronDownIcon } from "lucide-react";
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

export function BlockItemHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center justify-start gap-2.5 pb-1 pl-2 leading-tight font-semibold">
      {children}
    </div>
  );
}

export function BlockItemTitle({ children }: { children: ReactNode }) {
  return <p className="min-w-0 shrink truncate leading-tight font-semibold">{children}</p>;
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
} & (
  | ({
      asElement: "button";
    } & TButtonProps)
  | ({
      asElement: "div";
    } & React.HTMLAttributes<HTMLDivElement>)
);

export function BlockItemButtonLike({
  Icon,
  text,
  open,
  asElement,
  isPending,
  className,
  hideChevron,
  ...props
}: TBlockItemButtonLikeProps) {
  const Element = asElement === "button" ? Button : "div";
  return (
    // @ts-expect-error this is fine. Typescript isn't smart enough
    <Element
      variant="outline"
      data-open={open ? true : undefined}
      data-pending={isPending ? true : undefined}
      className={cn(
        "group/button flex w-full flex-row items-center justify-start gap-2 rounded-lg border px-3 py-2.5 text-left data-pending:text-transparent",
        className,
      )}
      {...props}
    >
      <div className="group-data-pending/button:animate-skeleton flex min-w-0 flex-1 items-center justify-start gap-2">
        <Icon className="group-data-pending/button:bg-foreground size-5 shrink-0 group-data-pending/button:rounded-full" />
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
