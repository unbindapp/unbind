"use client";

import { useMetricsState } from "@/components/metrics/metrics-state-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NonDefaultIndicator from "@/components/ui/non-default-indicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { TMetricsIntervalEnum } from "@/lib/queries/metrics";
import { FilterIcon, RotateCcwIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

export type TMetricsSelectionItem = { id: string; name: string; icon?: ReactNode };

export type TMetricsSelection = {
  label: string;
  /** Undefined while the list is still loading; the group is hidden until then. */
  items: TMetricsSelectionItem[] | undefined;
};

type TProps = {
  selection?: TMetricsSelection;
  className?: string;
};

const dropdownCollisionPadding = { top: 16, bottom: 16, left: 8, right: 8 };
const itemClassName = "py-3.5 sm:py-2.25";
const checkboxItemClassName = "py-3 sm:py-2.25";

export default function MetricsFilterDropdown({ selection, className }: TProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { interval, intervals, setInterval, resetFilters, hasActiveFilters, selectionEnabled } =
    useMetricsState();

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger
        className="px-3"
        render={
          <Button
            data-open={isDropdownOpen || undefined}
            data-non-default={hasActiveFilters || undefined}
            aria-label="Filter Metrics"
            type="button"
            variant="outline"
            className={cn(
              "group/button relative touch-manipulation gap-1.5 py-2 text-left font-medium",
              className,
            )}
          >
            <FilterIcon className="group-data-non-default/button:text-warning -ml-0.5 size-4.5 shrink-0" />
            <p className="min-w-0 shrink truncate">Filter</p>
            <NonDefaultIndicator isNotDefaultState={hasActiveFilters} />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        collisionPadding={dropdownCollisionPadding}
        className="max-h-[calc(var(--available-height)-4rem)] w-3xl sm:max-h-[min(45rem,calc(var(--available-height)-4rem))] sm:w-80"
      >
        <ScrollArea className="min-h-0 shrink">
          <DropdownMenuGroup className="pb-2">
            <DropdownMenuLabel>Time Range</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={interval.value}
              onValueChange={(value: TMetricsIntervalEnum) => setInterval(value)}
              className="grid w-full grid-cols-4 gap-1.5 px-1.5 pt-1.5"
            >
              {intervals.map((i) => (
                <Button
                  key={i.value}
                  size="sm"
                  variant="outline"
                  render={<DropdownMenuRadioItem hideIndicator value={i.value} />}
                  className="data-checked:border-foreground text-muted-foreground data-checked:text-foreground data-highlighted:bg-border data-highlighted:text-foreground w-full justify-center px-2 py-1.5 font-mono font-semibold"
                >
                  {i.label}
                </Button>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          {selectionEnabled && selection?.items && (
            <SelectionGroup label={selection.label} items={selection.items} />
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            data-not-default={hasActiveFilters || undefined}
            disabled={!hasActiveFilters}
            closeOnClick={false}
            onClick={() => resetFilters()}
            className={cn(
              "group/item data-not-default:text-warning data-not-default:data-highlighted:bg-warning/4-10 data-not-default:active:bg-warning/4-10",
              itemClassName,
            )}
          >
            <RotateCcwIcon className="-my-1 size-4.5 shrink-0 -rotate-90 transform transition-transform group-data-not-default/item:rotate-0" />
            <p className="min-w-0 shrink">Clear Filters</p>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SelectionGroup({ label, items }: { label: string; items: TMetricsSelectionItem[] }) {
  const { selectedIds, setSelectedIds } = useMetricsState();

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {items.length === 0 && (
          <DropdownMenuItem
            disabled
            className={cn("text-muted-foreground px-2.5", checkboxItemClassName)}
          >
            <p className="min-w-0 shrink font-normal">No {label.toLowerCase()} yet</p>
          </DropdownMenuItem>
        )}
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.id}
            className={checkboxItemClassName}
            checked={selectedIds.includes(item.id)}
            onCheckedChange={(checked) =>
              setSelectedIds(
                checked ? [...selectedIds, item.id] : selectedIds.filter((id) => id !== item.id),
              )
            }
          >
            <div className="flex min-w-0 shrink items-center gap-2">
              {item.icon}
              <p className="min-w-0 truncate">{item.name}</p>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
    </>
  );
}
