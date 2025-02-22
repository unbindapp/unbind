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
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";

type Props = {
  className?: string;
};

const settingsSort = (a: string, b: string) => a.localeCompare(b);

export default function TopBar({ className }: Props) {
  const [settings, setSettings] = useQueryState(
    "settings",
    parseAsArrayOf(parseAsString).withDefault(
      ["timestamp", "service_id", "line_wrapping"].sort(settingsSort)
    )
  );
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
                aria-label="Log Settings"
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
                {logSetting.map((group, index) => (
                  <div key={group.label} className="w-full flex flex-col">
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="pb-0">
                      {group.label}
                    </DropdownMenuLabel>
                    <DropdownMenuGroup title={group.label}>
                      {group.settings.map((setting) =>
                        setting.type === "checkbox" ? (
                          <DropdownMenuCheckboxItem
                            checked={settings.includes(setting.value)}
                            onCheckedChange={(checked) => {
                              setSettings((prevSettings) => {
                                if (checked) {
                                  if (!prevSettings.includes(setting.value)) {
                                    return [
                                      ...prevSettings,
                                      setting.value,
                                    ].sort(settingsSort);
                                  }
                                  return prevSettings.sort(settingsSort);
                                } else {
                                  return prevSettings
                                    .filter((s) => s !== setting.value)
                                    .sort(settingsSort);
                                }
                              });
                            }}
                            key={setting.value}
                          >
                            <p className="shrink min-w-0">{setting.label}</p>
                          </DropdownMenuCheckboxItem>
                        ) : (
                          <DropdownMenuItem key={setting.value}>
                            <p className="shrink min-w-0">{setting.label}</p>
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

type TLogSetting = {
  value: string;
  label: string;
  type: "checkbox" | "default";
};

type TLogSettingGroup = {
  label: string;
  settings: TLogSetting[];
};

const logSetting: TLogSettingGroup[] = [
  {
    label: "Columns",
    settings: [
      {
        value: "timestamp",
        label: "Timestamp",
        type: "checkbox",
      },
      {
        value: "service_id",
        label: "Service Name",
        type: "checkbox",
      },
    ],
  },
  {
    label: "Settings",
    settings: [
      {
        value: "line_wrapping",
        label: "Line Wrapping",
        type: "checkbox",
      },
    ],
  },
];
