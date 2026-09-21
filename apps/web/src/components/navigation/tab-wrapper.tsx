import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export default function TabWrapper({ children, className, id }: TProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex w-full flex-col gap-2 px-3 pt-3 pb-16 select-text sm:px-6 sm:pt-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
