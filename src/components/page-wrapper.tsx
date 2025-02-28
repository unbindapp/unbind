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
        "w-full flex flex-col items-center px-2 pt-4 sm:px-3 md:px-6 md:pt-5 lg:pt-7 lg:px-8 pb-16 relative",
        className
      )}
    >
      {children}
    </div>
  );
}
