"use client";

import { useMetricsState } from "@/components/metrics/metrics-state-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";

type TProps = {
  className?: string;
};

export default function MetricsIntervalDropdown({ className }: TProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { interval, intervals, setInterval } = useMetricsState();

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild className="px-3">
        <Button
          data-open={isDropdownOpen ? true : undefined}
          aria-label="Metrics Interval"
          type="button"
          variant="outline"
          className={cn(
            "group/button w-42 touch-manipulation justify-between py-2 text-left font-medium",
            className,
          )}
        >
          <p className="min-w-0 shrink truncate">{interval.label}</p>
          <ChevronDownIcon className="text-muted-more-foreground -mr-1 size-4.5 shrink-0 transition-transform group-data-open/button:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[var(--radix-popper-anchor-width)]">
        <ScrollArea>
          <DropdownMenuGroup>
            {intervals.map((i) => (
              <DropdownMenuItem
                onSelect={() => setInterval(i.value)}
                key={i.value}
                className="group/item gap-4 py-3.5 sm:py-2.25"
                data-selected={i.value === interval.value ? true : undefined}
              >
                <p className="min-w-0 flex-1">{i.label}</p>
                <div className="-mr-1 size-4.5">
                  <CheckIcon
                    strokeWidth={3}
                    className="size-full opacity-0 group-data-selected/item:opacity-100"
                  />
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
