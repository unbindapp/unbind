import { ScrollArea } from "@/components/ui/scroll-area";
import { ReactNode, Ref } from "react";

type TProps = {
  noArea?: boolean;
  className?: string;
  viewportRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
};

export default function ConditionalScrollArea({
  noArea,
  children,
  className,
  viewportRef,
}: TProps) {
  if (noArea) return children;
  return (
    <ScrollArea classNameViewport={className} viewportRef={viewportRef}>
      {children}
    </ScrollArea>
  );
}
