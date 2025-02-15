import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { FC, ReactNode, useState } from "react";

type Props = {
  title: string;
  Trigger: ReactNode;
  Icon?: FC<{ className: string }>;
  open: boolean;
  setOpen: (open: boolean) => void;
  classNameContent?: string;
  children: ReactNode;
};

export default function BottomDrawer({
  title,
  Trigger,
  Icon,
  open,
  setOpen,
  classNameContent,
  children,
}: Props) {
  const [hideHandle, setHideHandle] = useState(false);
  return (
    <Drawer
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setHideHandle(true);
        } else {
          setHideHandle(false);
        }
        setOpen(open);
      }}
      autoFocus={open}
      direction="bottom"
    >
      <DrawerTrigger asChild>{Trigger}</DrawerTrigger>
      <DrawerContent
        className={cn(
          "h-[calc(min(24rem,calc(100vh-3rem)))]",
          classNameContent
        )}
        hasHandle
        hideHandle={hideHandle}
      >
        <div className="w-full flex items-center justify-start gap-1 border-b">
          <DrawerHeader className="flex-1 min-w-0 flex items-center justify-start p-0">
            {Icon && <Icon className="size-7 sm:size-8 -ml-1" />}
            <DrawerTitle className="pl-5 min-w-0 gap-2.5 py-3.5 whitespace-nowrap overflow-hidden overflow-ellipsis shrink leading-tight text-xl sm:text-2xl text-left">
              {title}
            </DrawerTitle>
          </DrawerHeader>
        </div>
        <div className="w-full flex flex-col min-h-0 flex-1">
          <div className="flex flex-col flex-1 min-h-0">
            <ScrollArea>{children}</ScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
