import { Button, TButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ChevronDownIcon } from "lucide-react";
import { Children, cloneElement, FC, isValidElement, ReactNode } from "react";

export function Block({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-2 -mt-1 flex w-[calc(100%+1rem)] flex-col gap-4 md:flex-row md:gap-0">
      {children}
    </div>
  );
}

export function BlockItemHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full items-center justify-start gap-2.5 px-2 pb-1 leading-tight font-semibold">
      {children}
    </div>
  );
}

export function BlockItemTitle({ children }: { children: ReactNode }) {
  return <p className="min-w-0 shrink truncate leading-tight font-semibold">{children}</p>;
}

export function BlockItem({ children }: { children: ReactNode }) {
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
    <div className="flex w-full flex-col gap-1 px-2 md:w-1/2">
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

export function BlockItemButtonLike({
  Icon,
  text,
  open,
  asElement,
  ...props
}: {
  Icon: FC<{ className?: string }>;
  text: string;
  open?: boolean;
} & (
  | ({
      asElement: "button";
    } & TButtonProps)
  | ({
      asElement: "div";
    } & React.HTMLAttributes<HTMLDivElement>)
)) {
  const Element = asElement === "button" ? Button : "div";
  return (
    // @ts-expect-error this is fine. Typescript isn't smart enough
    <Element
      variant="outline"
      data-open={open ? true : undefined}
      className="group/button flex w-full flex-row items-center justify-start gap-2 rounded-lg border px-3 py-2.5 text-left"
      {...props}
    >
      <Icon className="size-5 shrink-0 scale-90" />
      <p className="min-w-0 flex-1 shrink truncate leading-tight font-medium">{text}</p>
      {open !== undefined && (
        <ChevronDownIcon className="text-muted-foreground -mr-0.75 size-5 transition group-data-open/button:rotate-180" />
      )}
    </Element>
  );
}
