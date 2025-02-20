import { useDeviceType } from "@/components/providers/device-type-provider";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  showOnTouchscreen?: boolean;
};

export default function KeyboardShortcut({
  className,
  showOnTouchscreen,
  children,
}: Props) {
  const { isTouchscreen } = useDeviceType();

  if (isTouchscreen && !showOnTouchscreen) {
    return null;
  }

  return (
    <div className={cn("shrink-0", className)}>
      <div
        className="text-xxs ring-1 ring-border rounded px-1.5 py-1.25 
        leading-none bg-background-hover"
      >
        {children}
      </div>
    </div>
  );
}
