import {
  logViewPreferences,
  useLogViewPreferences,
} from "@/components/logs/log-view-preference-provider";
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
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

type Props = {
  className?: string;
};

const viewPreferencesDropdownId = "view_preferences";

export default function TopBar({ className }: Props) {
  const {
    preferences: viewPreferences,
    setPreferences: setViewPreferences,
    isDefaultState: isViewPreferencesDefault,
    resetPreferences: resetViewPreferences,
  } = useLogViewPreferences();
  const [dropdown, setDropdown] = useQueryState("dropdown");

  const isViewPreferencesDropdownOpen = dropdown === viewPreferencesDropdownId;
  const setIsViewPreferencesDropdownOpen = (open: boolean) => {
    setDropdown(open ? viewPreferencesDropdownId : null);
  };

  return (
    <div className={cn("w-full items-stretch flex gap-2", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Search", {
            description: "This is fake",
            duration: 2000,
            closeButton: false,
          });
        }}
        className="flex-1 flex items-stretch relative"
      >
        <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="flex-1 py-2.25 pl-8.5 pr-22"
          placeholder="Search logs..."
        />
        <div className="absolute flex justify-end right-0 top-0 h-full">
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
            className="h-auto border-l rounded-none w-10"
          >
            <FilterIcon className="size-5" />
          </Button>
          <DropdownMenu
            open={isViewPreferencesDropdownOpen}
            onOpenChange={setIsViewPreferencesDropdownOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                data-open={isViewPreferencesDropdownOpen ? true : undefined}
                aria-label="Log View Preferences"
                type="button"
                size="icon"
                variant="ghost"
                className="h-auto text-foreground w-10 rounded-l-none rounded-r-lg border-l group/button relative"
              >
                <div
                  data-show={!isViewPreferencesDefault ? true : undefined}
                  className="absolute pointer-events-none opacity-0 scale-75 data-[show]:scale-100 data-[show]:opacity-100 transition top-1 right-1 bg-warning size-1.5 rounded-full"
                />
                <div className="size-5 relative group-data-[open]/button:rotate-90 transition-transform">
                  <SettingsIcon className="size-full opacity-100 group-data-[open]/button:opacity-0 transition-opacity" />
                  <XIcon
                    className="size-full absolute left-0 top-0 -rotate-90 opacity-0 
                    transition-opacity group-data-[open]/button:opacity-100"
                  />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[768px] sm:w-56">
              <ScrollArea>
                {logViewPreferences.map((group, index) => (
                  <div key={group.label} className="w-full flex flex-col">
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="pb-0">
                      {group.label}
                    </DropdownMenuLabel>
                    <DropdownMenuGroup title={group.label}>
                      {group.items.map((item) =>
                        item.type === "checkbox" ? (
                          <DropdownMenuCheckboxItem
                            className="py-3.5 sm:py-2.25"
                            checked={viewPreferences.includes(item.value)}
                            onCheckedChange={(checked) => {
                              setViewPreferences((prevSettings) => {
                                if (
                                  checked &&
                                  prevSettings.includes(item.value)
                                ) {
                                  return prevSettings;
                                }
                                if (checked) {
                                  return [...prevSettings, item.value];
                                }
                                return prevSettings.filter(
                                  (setting) => setting !== item.value
                                );
                              });
                            }}
                            key={item.value}
                          >
                            <p className="shrink min-w-0">{item.label}</p>
                          </DropdownMenuCheckboxItem>
                        ) : (
                          <DropdownMenuItem
                            className="py-3.5 sm:py-2.25"
                            key={item.value}
                          >
                            <p className="shrink min-w-0">{item.label}</p>
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuGroup>
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={isViewPreferencesDefault}
                    onSelect={(e) => {
                      e.preventDefault();
                      resetViewPreferences();
                    }}
                    className="py-3.5 sm:py-2.25"
                  >
                    <RotateCcwIcon
                      data-default={isViewPreferencesDefault ? true : undefined}
                      className="size-4.5 shrink-0 -my-1 transform rotate-90 data-[default]:rotate-0 transition"
                    />
                    <p className="shrink min-w-0">Reset</p>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </form>
    </div>
  );
}
