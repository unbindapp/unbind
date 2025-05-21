import { useMainStore } from "@/components/stores/main/main-store-provider";
import { cn } from "@/components/ui/utils";
import { useEffect, useMemo } from "react";
import { useDebounceValue } from "usehooks-ts";

export function NewEntityIndicator({ id, className }: { id: string; className?: string }) {
  const entity = useMainStore((s) => s.newlyCreatedEntities.get(id));

  const [debouncedMounted, setDebouncedMounted] = useDebounceValue(false, 100);

  useEffect(() => {
    if (typeof window !== "undefined") setDebouncedMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showIndicator = useMemo(() => {
    if (!debouncedMounted || !entity || entity.isOpened) return false;
    return true;
  }, [debouncedMounted, entity]);

  return (
    <div
      data-show={showIndicator ? true : undefined}
      className={cn(
        "group/indicator pointer-events-none absolute -top-[1px] left-0 flex h-full w-full items-start justify-center overflow-hidden px-2 opacity-0 transition-opacity duration-500 data-show:opacity-100",
        className,
      )}
    >
      <div className="from-success/0 via-success to-success/0 h-[1.5px] w-full bg-gradient-to-r" />
      <div className="from-success via-success/0 absolute top-0 left-1/2 h-3 w-1/2 -translate-x-1/2 -translate-y-1/2 bg-radial transition" />
    </div>
  );
}
