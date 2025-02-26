import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function PageWrapper({ className, children }: Props) {
  return (
    <div
      className={cn(
        "w-full flex flex-col items-center px-2 sm:px-3 md:px-8 pt-4 md:pt-7 pb-16",
        className
      )}
    >
      {children}
    </div>
  );
}
