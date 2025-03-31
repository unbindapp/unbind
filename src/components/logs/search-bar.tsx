import { useLogViewDropdown } from "@/components/logs/log-view-dropdown-provider";
import {
  logViewPreferences,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import {
  FilterIcon,
  LoaderIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

type TProps = {
  isPendingLogs: boolean;
  className?: string;
};

export default function SearchBar({ isPendingLogs, className }: TProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [searchInputValue, setSearchInputValue] = useState(search);

  return (
    <div className={cn("flex w-full items-stretch gap-2", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInputValue);
        }}
        className="relative flex flex-1 items-stretch"
      >
        <div className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2">
          {isPendingLogs ? (
            <LoaderIcon className="size-full animate-spin" />
          ) : (
            <SearchIcon className="size-full" />
          )}
        </div>
        <Input
          value={searchInputValue}
          type="text"
          onChange={(e) => {
            setSearchInputValue(e.target.value);
            if (!e.target.value) setSearch("");
          }}
          name="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          inputMode="search"
          enterKeyHint="search"
          className="flex-1 rounded-lg py-2.25 pr-22 pl-8.5"
          placeholder="Search logs..."
        />
        <div className="absolute top-0 right-0 flex h-full justify-end">
          <Button
            aria-label="Filter Logs"
            onClick={() => {
              toast.success("Filter", {
                description: "This is fake",
                duration: 2000,
                closeButton: false,
              });
            }}
            type="button"
            size="icon"
            variant="ghost"
            className="h-auto w-10 rounded-none border-l"
          >
            <FilterIcon className="size-5" />
          </Button>
          <SettingsButton className="group/button relative h-auto w-10 rounded-l-none rounded-r-lg border-l" />
        </div>
      </form>
    </div>
  );
}

function SettingsButton({ className }: { className?: string }) {
  const { preferences, setPreferences, isDefaultState, resetPreferences } = useLogViewPreferences();
  const [isDropdownOpen, setIsDropdownOpen] = useLogViewDropdown();

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isDropdownOpen ? true : undefined}
          aria-label="Log View Preferences"
          type="button"
          size="icon"
          variant="ghost"
          className={cn("touch-manipulation", className)}
        >
          <div
            data-show={!isDefaultState ? true : undefined}
            className="bg-warning pointer-events-none absolute top-1.25 right-1.25 size-1.25 scale-75 rounded-full opacity-0 transition data-show:scale-100 data-show:opacity-100"
          />
          <div className="relative size-5 transition-transform group-data-open/button:rotate-90">
            <SettingsIcon className="size-full opacity-100 transition-opacity group-data-open/button:opacity-0" />
            <XIcon className="absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-open/button:opacity-100" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[768px] sm:w-56">
        <ScrollArea>
          {logViewPreferences.map((group, index) => (
            <div key={group.label} className="flex w-full flex-col">
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="pb-0">{group.label}</DropdownMenuLabel>
              <DropdownMenuGroup title={group.label}>
                {group.items.map((item) =>
                  item.type === "checkbox" ? (
                    <DropdownMenuCheckboxItem
                      className="py-3.5 sm:py-2.25"
                      checked={preferences.includes(item.value)}
                      onCheckedChange={(checked) => {
                        setPreferences((prevSettings) => {
                          if (checked && prevSettings.includes(item.value)) {
                            return prevSettings;
                          }
                          if (checked) {
                            return [...prevSettings, item.value];
                          }
                          return prevSettings.filter((setting) => setting !== item.value);
                        });
                      }}
                      key={item.value}
                    >
                      <p className="min-w-0 shrink">{item.label}</p>
                    </DropdownMenuCheckboxItem>
                  ) : (
                    <DropdownMenuItem className="py-3.5 sm:py-2.25" key={item.value}>
                      <p className="min-w-0 shrink">{item.label}</p>
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuGroup>
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={isDefaultState}
              onSelect={(e) => {
                e.preventDefault();
                resetPreferences();
              }}
              className="py-3.5 sm:py-2.25"
            >
              <RotateCcwIcon
                data-default={isDefaultState ? true : undefined}
                className="-my-1 size-4.5 shrink-0 rotate-90 transform transition data-default:rotate-0"
              />
              <p className="min-w-0 shrink">Reset</p>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
