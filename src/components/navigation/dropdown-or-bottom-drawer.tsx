import BottomDrawer, {
  BottomDrawerContent,
  BottomDrawerTrigger,
} from "@/components/navigation/bottom-drawer";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { Children, cloneElement, isValidElement, ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classNameDropdown?: string;
  align?: Parameters<typeof DropdownMenuContent>[0]["align"];
  sideOffset?: Parameters<typeof DropdownMenuContent>[0]["sideOffset"];
};

export function DropdownOrBottomDrawer({
  title,
  open,
  onOpenChange,
  classNameDropdown,
  align = "start",
  sideOffset = -1,
  children,
}: Props) {
  const { isExtraSmall } = useDeviceSize();

  const childrenArray = Children.toArray(children);
  const Trigger = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === DropdownOrBottomDrawerTriggerName
  );
  const ContentDrawer = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === DropdownOrBottomDrawerContentDrawerName
  );
  const ContentDropdown = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === DropdownOrBottomDrawerContentDropdownName
  );

  if (isExtraSmall) {
    return (
      <BottomDrawer title={title} open={open} onOpenChange={onOpenChange}>
        <BottomDrawerTrigger>{Trigger}</BottomDrawerTrigger>
        <BottomDrawerContent>{ContentDrawer}</BottomDrawerContent>
      </BottomDrawer>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{Trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn("sm:max-w-64", classNameDropdown)}
        align={align}
        sideOffset={sideOffset}
      >
        <ScrollArea className="group/list w-full" noFocusOnViewport>
          {ContentDropdown}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownOrBottomDrawerTrigger({
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
const DropdownOrBottomDrawerTriggerName = "DropdownOrBottomDrawerTrigger";
DropdownOrBottomDrawerTrigger.displayName = DropdownOrBottomDrawerTriggerName;

function DropdownOrBottomDrawerContentDropdown({
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
const DropdownOrBottomDrawerContentDropdownName =
  "DropdownOrBottomDrawerContentDropdown";
DropdownOrBottomDrawerContentDropdown.displayName =
  DropdownOrBottomDrawerContentDropdownName;

function DropdownOrBottomDrawerContentDrawer({
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
const DropdownOrBottomDrawerContentDrawerName =
  "DropdownOrBottomDrawerContentDrawer";
DropdownOrBottomDrawerContentDrawer.displayName =
  DropdownOrBottomDrawerContentDrawerName;

function hasDisplayName(type: unknown): type is { displayName: string } {
  return typeof (type as { displayName: string })?.displayName === "string";
}

export {
  DropdownOrBottomDrawerContentDrawer,
  DropdownOrBottomDrawerContentDropdown,
  DropdownOrBottomDrawerTrigger,
};
