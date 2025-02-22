import useLogViewPreferences, {
  logViewPreferenceKeys,
} from "@/components/logs/use-log-view-preferences";
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
import { FilterIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  className?: string;
};

export default function TopBar({ className }: Props) {
  const [viewPreferences, setViewPreferences] = useLogViewPreferences();
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Log View Preferences"
                type="button"
                size="icon"
                variant="ghost"
                className="h-auto text-foreground w-10 rounded-l-none rounded-r-lg border-l"
              >
                <SettingsIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="sm:max-w-64">
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
                          <DropdownMenuItem key={item.value}>
                            <p className="shrink min-w-0">{item.label}</p>
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuGroup>
                  </div>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </form>
    </div>
  );
}

type TLogViewPreference = {
  value: string;
  label: string;
  type: "checkbox" | "default";
};

type TLogViewPreferenceGroup = {
  label: string;
  items: TLogViewPreference[];
};

const logViewPreferences: TLogViewPreferenceGroup[] = [
  {
    label: "Columns",
    items: [
      {
        value: logViewPreferenceKeys.timestamp,
        label: "Timestamp",
        type: "checkbox",
      },
      {
        value: logViewPreferenceKeys.serviceId,
        label: "Service Name",
        type: "checkbox",
      },
    ],
  },
  {
    label: "Preferences",
    items: [
      {
        value: logViewPreferenceKeys.lineWrapping,
        label: "Line Wrapping",
        type: "checkbox",
      },
    ],
  },
];
