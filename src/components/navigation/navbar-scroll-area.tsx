"use client";

import { useDeviceType } from "@/components/providers/device-type-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";

type TProps = {
  className?: string;
  children: React.ReactNode;
};

export default function NavbarScrollArea({ className, children }: TProps) {
  const { isTouchscreen } = useDeviceType();
  return (
    <div
      className={cn(
        "flex min-w-0 shrink items-stretch justify-start self-stretch overflow-hidden",
        className,
      )}
    >
      <ScrollArea
        data-touchscreen={isTouchscreen ? true : undefined}
        scrollBarClassName="group-data-touchscreen/scrollarea:hidden"
        orientation="horizontal"
        className="group/scrollarea min-w-0 overflow-auto"
      >
        <div className="flex items-stretch justify-start">{children}</div>
      </ScrollArea>
    </div>
  );
}
