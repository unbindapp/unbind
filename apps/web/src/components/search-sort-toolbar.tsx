import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
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
import SearchInput from "@/components/ui/search-input";
import { cn } from "@/components/ui/utils";
import { defaultListSort, ListSortEnum, listSorts, type TListSort } from "@/lib/list-sort";
import { CheckIcon, ListFilterIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useState } from "react";

const dropdownCollisionPadding = { top: 16, bottom: 16, left: 8, right: 8 };
const itemClassName = "py-3.5 sm:py-2.25";

type TProps = {
  searchPlaceholder: string;
  sortLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  sort: TListSort;
  onSortChange: (value: TListSort) => void;
  className?: string;
};

export default function SearchSortToolbar({
  searchPlaceholder,
  sortLabel,
  search,
  onSearchChange,
  sort,
  onSortChange,
  className,
}: TProps) {
  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <SearchInput
        value={search}
        onValueChange={onSearchChange}
        placeholder={searchPlaceholder}
        className="min-w-0 flex-1"
        classNameInput="bg-card py-1.5"
        classNameClearButton="size-7.5"
      />
      <SortDropdown label={sortLabel} sort={sort} onSortChange={onSortChange} />
    </div>
  );
}

function SortDropdown({
  label,
  sort,
  onSortChange,
}: {
  label: string;
  sort: TListSort;
  onSortChange: (value: TListSort) => void;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const isNotDefaultState = sort !== defaultListSort;

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            data-open={isDropdownOpen || undefined}
            data-non-default={isNotDefaultState || undefined}
            aria-label={label}
            type="button"
            variant="outline"
            size="icon"
            className="bg-card relative size-9.5 rounded-lg"
          >
            <div className="group-data-non-default/button:text-warning relative size-4.5 shrink-0 transition-transform group-data-open/button:rotate-45">
              <ListFilterIcon className="size-full opacity-100 group-data-open/button:opacity-0" />
              <XIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-data-open/button:opacity-100" />
            </div>
            <NonDefaultIndicator isNotDefaultState={isNotDefaultState} />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        collisionPadding={dropdownCollisionPadding}
        className="max-h-[calc(var(--available-height)-4rem)] w-3xl sm:max-h-[min(45rem,calc(var(--available-height)-4rem))] sm:w-60"
      >
        <ScrollArea className="min-h-0 shrink">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => onSortChange(ListSortEnum.parse(value))}
              className="border-0 bg-transparent p-0"
            >
              {listSorts.map((s) => (
                <DropdownMenuRadioItem
                  key={s.value}
                  value={s.value}
                  hideIndicator
                  closeOnClick
                  className="group/item gap-2.5 rounded-md px-3 py-2.5 text-base leading-tight font-medium"
                >
                  <p className="min-w-0 flex-1">{s.label}</p>
                  <CheckIcon className="size-4.5 shrink-0 opacity-0 group-data-checked/item:opacity-100" />
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            data-not-default={isNotDefaultState || undefined}
            disabled={!isNotDefaultState}
            onClick={() => onSortChange(defaultListSort)}
            className={cn(
              "group/item data-not-default:text-warning data-not-default:data-highlighted:bg-warning/4-10 data-not-default:active:bg-warning/4-10",
              itemClassName,
            )}
          >
            <RotateCcwIcon className="-my-1 size-4.5 shrink-0 -rotate-90 transform transition-transform group-data-not-default/item:rotate-0" />
            <p className="min-w-0 shrink">Reset Sort</p>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
