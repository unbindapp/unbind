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
import { Children, cloneElement, FC, isValidElement, ReactNode } from "react";

type Props = {
  title: string;
  TitleIcon?: FC<{ className: string }>;
  titleSize?: "sm" | "md";
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classNameDropdown?: string;
  align?: Parameters<typeof DropdownMenuContent>[0]["align"];
  sideOffset?: Parameters<typeof DropdownMenuContent>[0]["sideOffset"];
};

export function DropdownOrDrawer({
  title,
  TitleIcon,
  titleSize,
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
      child.type.displayName === DropdownOrDrawerTriggerName
  );
  const ContentForDrawer = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === DropdownOrDrawerContentForDrawerName
  );
  const ContentForDropdown = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === DropdownOrDrawerContentForDropdownName
  );

  if (isExtraSmall) {
    return (
      <BottomDrawer
        title={title}
        TitleIcon={TitleIcon}
        titleSize={titleSize}
        open={open}
        onOpenChange={onOpenChange}
      >
        <BottomDrawerTrigger>{Trigger}</BottomDrawerTrigger>
        <BottomDrawerContent>{ContentForDrawer}</BottomDrawerContent>
      </BottomDrawer>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild className="">
        {Trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn("sm:max-w-64", classNameDropdown)}
        align={align}
        sideOffset={sideOffset}
      >
        <ScrollArea className="group/list w-full" noFocusOnViewport>
          {ContentForDropdown}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownOrDrawerTrigger({
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
const DropdownOrDrawerTriggerName = "DropdownOrDrawerTrigger";
DropdownOrDrawerTrigger.displayName = DropdownOrDrawerTriggerName;

function DropdownOrDrawerContentForDropdown({
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
const DropdownOrDrawerContentForDropdownName =
  "DropdownOrDrawerContentForDropdown";
DropdownOrDrawerContentForDropdown.displayName =
  DropdownOrDrawerContentForDropdownName;

function DropdownOrDrawerContentForDrawer({
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
const DropdownOrDrawerContentForDrawerName = "DropdownOrDrawerContentForDrawer";
DropdownOrDrawerContentForDrawer.displayName =
  DropdownOrDrawerContentForDrawerName;

function hasDisplayName(type: unknown): type is { displayName: string } {
  return typeof (type as { displayName: string })?.displayName === "string";
}

export {
  DropdownOrDrawerContentForDrawer,
  DropdownOrDrawerContentForDropdown,
  DropdownOrDrawerTrigger,
};
