import ConditionalScrollArea from "@/components/conditional-scroll-area";
import {
  PanelScrollKeyProvider,
  usePanelScrollRestoration,
} from "@/components/panel/use-panel-scroll-state";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  noScrollArea?: boolean;
  scrollKey?: string;
  children?: ReactNode;
  className?: string;
};

export default function PanelTabWrapper({ noScrollArea, scrollKey, children, className }: TProps) {
  const viewportRef = usePanelScrollRestoration(scrollKey ?? null);

  return (
    <PanelScrollKeyProvider scrollKey={scrollKey ?? null}>
      <div
        data-base-ui-swipe-ignore
        className={cn("flex min-h-0 w-full flex-1 flex-col", className)}
      >
        <ConditionalScrollArea
          className="pb-(--safe-area-inset-bottom)"
          noArea={noScrollArea}
          viewportRef={viewportRef}
        >
          {children}
        </ConditionalScrollArea>
      </div>
    </PanelScrollKeyProvider>
  );
}
