import { ScrollArea } from "@/components/ui/scroll-area";
import { ReactNode } from "react";

type TProps = {
  noArea?: boolean;
  children?: ReactNode;
};

export default function ConditionalScrollArea({ noArea, children }: TProps) {
  if (noArea) return children;
  return <ScrollArea viewportClassName="pb-[var(--safe-area-inset-bottom)]">{children}</ScrollArea>;
}
