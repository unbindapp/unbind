import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { FC, ReactNode } from "react";

type Props = {
  title: string;
  Trigger: ReactNode;
  Icon?: FC<{ className: string }>;
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
  Trigger,
  Icon,
  open,
  onOpenChange,
  classNameContent,
  children,
  hideHeader,
  noScrollArea,
  dontAutoFocus,
  onEscapeKeyDown,
}: Props) {
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
          className="w-full flex items-center justify-start gap-1 border-b data-[hide-header]:sr-only"
        >
          <DrawerHeader className="flex-1 px-0 py-3 min-w-0 flex items-center justify-start">
            {Icon && <Icon className="size-7 sm:size-8 -ml-1 -my-2" />}
            <DrawerTitle className="pl-5 min-w-0 gap-2.5 whitespace-nowrap overflow-hidden overflow-ellipsis shrink leading-tight text-xl sm:text-2xl text-left">
              {title}
            </DrawerTitle>
          </DrawerHeader>
        </div>
        <ConditionalScrollWrapper noScrollArea={noScrollArea}>
          {children}
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
