import { cn } from "@/components/ui/utils";
import { ChevronRight } from "lucide-react";

type TProps = {
  className?: string;
  canScrollRight?: boolean;
};

export default function OverscrollIndicator({ canScrollRight, className }: TProps) {
  return (
    <div
      data-visible={canScrollRight || undefined}
      className={cn(
        "from-background via-background to-background/0 pointer-events-none absolute top-0 right-0 z-10 flex h-[calc(100%-1px)] translate-x-full flex-col items-center justify-center bg-linear-to-l pr-1.5 pl-10 opacity-0 transition data-visible:translate-x-0 data-visible:opacity-100",
        className,
      )}
    >
      <ChevronRight className="text-muted-more-foreground size-5" />
    </div>
  );
}
