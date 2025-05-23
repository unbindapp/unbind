import { cn } from "@/components/ui/utils";
import { HTMLAttributes, ReactNode } from "react";

type TProps = {
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export default function PanelContentWrapper({ className, children, ...rest }: TProps) {
  return (
    <div className={cn("flex w-full flex-1 flex-col overflow-hidden", className)} {...rest}>
      {children}
    </div>
  );
}
