import { ScrollArea } from "@/components/ui/scroll-area";
import { ReactNode } from "react";

type TProps = {
  noArea?: boolean;
  className?: string;
  children?: ReactNode;
};

export default function ConditionalScrollArea({ noArea, children, className }: TProps) {
  if (noArea) return children;
  return <ScrollArea classNameViewport={className}>{children}</ScrollArea>;
}
