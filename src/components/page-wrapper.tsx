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
        "relative flex w-full flex-1 flex-col items-center px-2 pt-4 pb-16 sm:px-3 md:px-6 md:pt-5 lg:px-8 lg:pt-7",
        className,
      )}
    >
      {children}
    </div>
  );
}
