import ConditionalScrollArea from "@/components/conditional-scroll-area";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  noScrollArea?: boolean;
  children: ReactNode;
  className?: string;
};

export default function PanelTabWrapper({ noScrollArea, children, className }: TProps) {
  return (
    <div data-vaul-no-drag className={cn("flex min-h-0 w-full flex-1 flex-col", className)}>
      <ConditionalScrollArea className="pb-[var(--safe-area-inset-bottom)]" noArea={noScrollArea}>
        {children}
      </ConditionalScrollArea>
    </div>
  );
}
