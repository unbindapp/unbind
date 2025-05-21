import { useMainStore } from "@/components/stores/main/main-store-provider";
import { cn } from "@/components/ui/utils";
import { useEffect, useMemo } from "react";
import { useDebounceValue } from "usehooks-ts";

export function NewlyCreatedEntityIndicator({ id, className }: { id: string; className?: string }) {
  const entity = useMainStore((s) => s.newlyCreatedEntities.get(id));

  const [debouncedMounted, setDebouncedMounted] = useDebounceValue(false, 300);

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
      className={cn(
        "pointer-events-none absolute -top-[1px] left-0 flex h-full w-full items-start justify-center px-2",
        className,
      )}
    >
      <div
        data-show={showIndicator ? true : undefined}
        className="from-success/0 via-success to-success/0 h-[1.5px] w-full bg-gradient-to-r opacity-0 transition-opacity duration-500 data-show:opacity-100"
      ></div>
    </div>
  );
}
