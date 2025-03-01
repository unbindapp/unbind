import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { Children, cloneElement, FC, isValidElement, ReactNode } from "react";

type Props = {
  title: string;
  TitleIcon?: FC<{ className: string }>;
  titleSize?: "sm" | "md";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classNameContent?: string;
  children: ReactNode;
  hideHeader?: boolean;
  noScrollArea?: boolean;
  dontAutoFocus?: boolean;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
};

export default function BottomDrawer({
  title,
  TitleIcon,
  titleSize = "md",
  open,
  onOpenChange,
  classNameContent,
  children,
  hideHeader,
  noScrollArea,
  dontAutoFocus,
  onEscapeKeyDown,
}: Props) {
  const childrenArray = Children.toArray(children);
  const Trigger = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "function" &&
      child.type.name === "BottomDrawerTrigger"
  );
  const Content = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "function" &&
      child.type.name === "BottomDrawerContent"
  );

  return (
    <Drawer
      autoFocus={dontAutoFocus ? false : open}
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
    >
      <DrawerTrigger asChild>{Trigger}</DrawerTrigger>
      <DrawerContent
        onEscapeKeyDown={onEscapeKeyDown}
        className={cn(
          "h-[calc(min(26.5rem,calc(100svh-3rem)))]",
          classNameContent
        )}
        hasHandle
      >
        <div
          data-hide-header={hideHeader ? true : undefined}
          className="w-full flex items-center justify-start gap-1 border-b data-hide-header:sr-only"
        >
          <DrawerHeader
            data-size={titleSize}
            className="flex-1 py-3 data-[size=sm]:py-3.5 px-5 min-w-0 flex items-center justify-start gap-2.5 group/header"
          >
            {TitleIcon && (
              <TitleIcon className="size-6 group-data-[size=sm]/header:size-5 group-data-[size=sm]/header:-ml-0.5 -ml-1 -my-2 shrink-0" />
            )}
            <DrawerTitle
              className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis shrink leading-tight text-xl sm:text-2xl sm:leading-tight text-left
              group-data-[size=sm]/header:text-lg group-data-[size=sm]/header:leading-tight 
              sm:group-data-[size=sm]/header:text-xl sm:group-data-[size=sm]/header:leading-tight"
            >
              {title}
            </DrawerTitle>
          </DrawerHeader>
        </div>
        <ConditionalScrollWrapper noScrollArea={noScrollArea}>
          {Content}
        </ConditionalScrollWrapper>
      </DrawerContent>
    </Drawer>
  );
}

function ConditionalScrollWrapper({
  noScrollArea,
  children,
}: {
  noScrollArea?: boolean;
  children: ReactNode;
}) {
  if (noScrollArea) {
    return children;
  }

  return (
    <div className="w-full flex flex-col min-h-0 flex-1">
      <div className="flex flex-col flex-1 min-h-0">
        <ScrollArea className="pb-[var(--safe-area-inset-bottom)]">
          {children}
        </ScrollArea>
      </div>
    </div>
  );
}

function BottomDrawerTrigger({
  children,
  ...rest
}: {
  children: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  if (isValidElement(children)) {
    return cloneElement(children, rest);
  }
  return children;
}

function BottomDrawerContent({
  children,
  ...rest
}: {
  children: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  if (isValidElement(children)) {
    return cloneElement(children, rest);
  }
  return children;
}

export { BottomDrawerTrigger, BottomDrawerContent };
