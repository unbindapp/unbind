import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function TabWrapper({ children, className }: Props) {
  return (
    <div
      className={cn(
        "w-full select-text flex flex-col px-3 pt-3 pb-16 sm:px-6 sm:pt-6 gap-2",
        className
      )}
    >
      {children}
    </div>
  );
}
