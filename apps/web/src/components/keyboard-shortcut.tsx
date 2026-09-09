import { useDeviceType } from "@/components/providers/device-type-provider";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  className?: string;
  classNameChip?: string;
  showOnTouchscreen?: boolean;
};

export default function KeyboardShortcut({
  className,
  classNameChip,
  showOnTouchscreen,
  children,
}: TProps) {
  const { isTouchscreen } = useDeviceType();

  if (isTouchscreen && !showOnTouchscreen) {
    return null;
  }

  return (
    <div className={cn("shrink-0", className)}>
      <div
        className={cn(
          "ring-border bg-card rounded px-1.5 py-1.25 text-xs leading-none ring-1",
          classNameChip,
        )}
      >
        {children}
      </div>
    </div>
  );
}
