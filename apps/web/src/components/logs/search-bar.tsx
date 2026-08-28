import {
  logLevels,
  logRangePresets,
  logTypeCapabilities,
  useLogFilters,
} from "@/components/logs/log-filters-provider";
import { useLogViewDropdown } from "@/components/logs/log-view-dropdown-provider";
import {
  logViewPreferenceKeys,
  logViewPreferences,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import type { TBufferedLogLine } from "@/components/logs/logs-provider";
import { useServices } from "@/components/service/services-provider";
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
import { defaultDebounceMs } from "@/lib/constants";
import { TLogLevel, TLogType } from "@/lib/queries/logs";
import { format } from "date-fns";
import {
  DownloadIcon,
  FilterIcon,
  LoaderIcon,
  RotateCcwIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

type TProps = {
  isPendingLogs: boolean;
  logType: TLogType;
  searchError: string | null;
  hasLogs: boolean;
  getLogsForDownload: () => TBufferedLogLine[] | null;
  className?: string;
};

const levelLabels: Record<TLogLevel, string> = {
  debug: "Debug",
  info: "Info",
  warning: "Warning",
  error: "Error",
};

function SearchBar({
  isPendingLogs,
  logType,
  searchError,
  hasLogs,
  getLogsForDownload,
  className,
}: TProps) {
  const { search, setSearch } = useLogFilters();
  const [inputValue, setInputValue] = useState(search);

  const debouncedSetSearch = useDebouncedCallback(setSearch, defaultDebounceMs);

  // adopt external changes (back/forward, shared links, reset) and drop any
  // pending debounced write so it can't resurrect a filter the user cleared
  const lastSyncedSearch = useRef(search);
  useEffect(() => {
    if (search === lastSyncedSearch.current) return;
    debouncedSetSearch.cancel();
    lastSyncedSearch.current = search;
    setInputValue(search);
  }, [search, debouncedSetSearch]);

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="flex w-full items-stretch gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            debouncedSetSearch.flush();
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
            value={inputValue}
            type="search"
            onChange={(e) => {
              setInputValue(e.target.value);
              lastSyncedSearch.current = e.target.value;
              if (!e.target.value) {
                debouncedSetSearch.cancel();
                setSearch("");
                return;
              }
              debouncedSetSearch(e.target.value);
            }}
            name="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            inputMode="search"
            enterKeyHint="search"
            aria-invalid={searchError ? true : undefined}
            className="flex-1 rounded-lg py-2.25 pr-22 pl-8.5"
            placeholder={`Search logs...   e.g. "timeout" -healthz @level:error`}
          />
          <div className="absolute top-0 right-0 flex h-full justify-end">
            <FilterButton />
            <SettingsButton
              logType={logType}
              hasLogs={hasLogs}
              getLogsForDownload={getLogsForDownload}
              className="group/button relative h-auto w-10 rounded-l-none rounded-r-lg border-l"
            />
          </div>
        </form>
      </div>
      {searchError && (
        <div className="w-full py-1.5">
          <p className="text-warning bg-warning/8 max-w-full rounded-sm px-2.5 py-1 text-xs leading-tight font-medium">
            {searchError}
          </p>
        </div>
      )}
    </div>
  );
}

const dropdownCollisionPadding = { top: 16, bottom: 16, left: 8, right: 8 };
const dropdownItemClassName = "py-3.5 sm:py-2.25";
const filterCheckboxItemClassName = "py-3 sm:py-2.25";

function FilterButton() {
  const {
    levels,
    setLevels,
    serviceIds,
    setServiceIds,
    range,
    setRange,
    resetFilters,
    hasActiveFilters,
    rangeIsSet,
    rangeEnabled,
    servicesEnabled,
  } = useLogFilters();

  const showActiveDot = levels.length > 0 || serviceIds.length > 0 || rangeIsSet;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Filter Logs"
            type="button"
            size="icon"
            variant="ghost"
            className="relative h-auto w-10 touch-manipulation rounded-none border-l"
          >
            <ActiveDot show={showActiveDot} />
            <FilterIcon
              data-active={showActiveDot || undefined}
              className="data-active:text-warning size-5 transition-colors"
            />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        collisionPadding={dropdownCollisionPadding}
        className="max-h-[calc(var(--available-height)-4rem)] w-3xl sm:max-h-[min(45rem,calc(var(--available-height)-4rem))] sm:w-80"
      >
        <ScrollArea className="min-h-0 shrink" classNameViewport="pb-4">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Levels</DropdownMenuLabel>
            {logLevels.map((level) => (
              <DropdownMenuCheckboxItem
                key={level}
                className={filterCheckboxItemClassName}
                checked={levels.includes(level)}
                onCheckedChange={(checked) =>
                  setLevels(checked ? [...levels, level] : levels.filter((l) => l !== level))
                }
              >
                <p
                  data-level={level}
                  className="data-[level=error]:text-destructive data-[level=warning]:text-warning data-[level=debug]:text-muted-foreground min-w-0 shrink"
                >
                  {levelLabels[level]}
                </p>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          {servicesEnabled && (
            <ServicesFilterGroup serviceIds={serviceIds} setServiceIds={setServiceIds} />
          )}
          {rangeEnabled && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Time Range</DropdownMenuLabel>
                <div
                  onKeyDown={(e) => {
                    if (e.key === "Escape") return;
                    e.stopPropagation();
                  }}
                  className="flex w-full flex-col gap-1.5 px-1.5 pt-1.5 pb-1.5"
                >
                  <div className="grid w-full grid-cols-4 gap-1.5">
                    {logRangePresets.map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        size="sm"
                        variant="outline"
                        tabIndex={-1}
                        data-selected={("preset" in range && range.preset === preset) || undefined}
                        onClick={() => setRange({ preset })}
                        className="data-selected:border-foreground text-muted-foreground data-selected:text-foreground w-full px-2 py-1.5 font-mono font-semibold"
                      >
                        {preset}
                      </Button>
                    ))}
                  </div>
                  <CustomRangeInputs className="pt-1.5" />
                </div>
              </DropdownMenuGroup>
            </>
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
              "group/item data-not-default:text-warning data-not-default:data-highlighted:bg-warning/10 data-not-default:active:bg-warning/10",
              dropdownItemClassName,
            )}
          >
            <RotateCcwIcon className="-my-1 size-4.5 shrink-0 -rotate-90 transform transition-transform group-data-not-default/item:rotate-0" />
            <p className="min-w-0 shrink">Reset Filters</p>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActiveDot({ show }: { show: boolean }) {
  return (
    <div
      data-show={show || undefined}
      className="bg-warning pointer-events-none absolute top-1.25 right-1.25 size-1.25 scale-75 rounded-full opacity-0 transition data-show:scale-100 data-show:opacity-100"
    />
  );
}

function ServicesFilterGroup({
  serviceIds,
  setServiceIds,
}: {
  serviceIds: string[];
  setServiceIds: (ids: string[]) => void;
}) {
  const {
    query: { data: servicesData },
  } = useServices();

  if (!servicesData) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Services</DropdownMenuLabel>
        {servicesData.services.length === 0 && (
          <DropdownMenuItem
            disabled
            className={cn("text-muted-foreground px-2.5", filterCheckboxItemClassName)}
          >
            <ServerIcon className="size-4" />
            <p className="min-w-0 shrink font-normal">No services yet</p>
          </DropdownMenuItem>
        )}
        {servicesData.services.map((service) => (
          <DropdownMenuCheckboxItem
            key={service.id}
            className={filterCheckboxItemClassName}
            checked={serviceIds.includes(service.id)}
            onCheckedChange={(checked) =>
              setServiceIds(
                checked
                  ? [...serviceIds, service.id]
                  : serviceIds.filter((id) => id !== service.id),
              )
            }
          >
            <p className="min-w-0 truncate">{service.name}</p>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
    </>
  );
}

function toDatetimeLocal(ms: number | undefined): string {
  if (!ms) return "";
  return format(new Date(ms), "yyyy-MM-dd'T'HH:mm");
}

function CustomRangeInputs({ className }: { className?: string }) {
  const { range, setRange } = useLogFilters();
  const custom = "preset" in range ? null : range;

  const [fromValue, setFromValue] = useState(toDatetimeLocal(custom?.from));
  const [toValue, setToValue] = useState(toDatetimeLocal(custom?.to));

  // follow external range changes (presets, reset, view-in-context)
  const lastApplied = useRef({ from: custom?.from, to: custom?.to });
  useEffect(() => {
    if (custom?.from === lastApplied.current.from && custom?.to === lastApplied.current.to) return;
    lastApplied.current = { from: custom?.from, to: custom?.to };
    setFromValue(toDatetimeLocal(custom?.from));
    setToValue(toDatetimeLocal(custom?.to));
  }, [custom?.from, custom?.to]);

  const applyCustom = (from: string, to: string) => {
    setFromValue(from);
    setToValue(to);
    const fromMs = from ? new Date(from).getTime() : NaN;
    const toMs = to ? new Date(to).getTime() : undefined;
    if (!Number.isFinite(fromMs)) return;
    if (toMs !== undefined && (!Number.isFinite(toMs) || toMs <= fromMs)) return;
    lastApplied.current = { from: fromMs, to: toMs };
    setRange({ from: fromMs, to: toMs });
  };

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div className="flex w-full flex-col gap-1.5">
        <label className="flex w-full items-center gap-4">
          <span className="text-muted-foreground w-10 shrink-0 px-1 text-sm font-medium">From</span>
          <Input
            type="datetime-local"
            tabIndex={-1}
            aria-label="From"
            value={fromValue}
            onChange={(e) => applyCustom(e.target.value, toValue)}
            className="bg-background w-full min-w-0 appearance-none px-2.5 py-2"
          />
        </label>
        <label className="flex w-full items-center gap-4">
          <span className="text-muted-foreground w-10 shrink-0 px-1 text-sm font-medium">To</span>
          <Input
            type="datetime-local"
            tabIndex={-1}
            aria-label="To"
            value={toValue}
            onChange={(e) => applyCustom(fromValue, e.target.value)}
            className="bg-background w-full min-w-0 appearance-none px-2.5 py-2"
          />
        </label>
      </div>
      {custom && (
        <p className="text-muted-foreground px-1 text-xs leading-tight">
          {custom.to ? "Fixed range (not live)" : "Live from the start time"}
        </p>
      )}
    </div>
  );
}

function SettingsButton({
  logType,
  hasLogs,
  getLogsForDownload,
  className,
}: {
  logType: TLogType;
  hasLogs: boolean;
  getLogsForDownload: () => TBufferedLogLine[] | null;
  className?: string;
}) {
  const { preferences, setPreferences, isDefaultState, resetPreferences } = useLogViewPreferences();
  const [isDropdownOpen, setIsDropdownOpen] = useLogViewDropdown();

  const downloadLogs = () => {
    const logs = getLogsForDownload();
    if (!logs || logs.length === 0) return;
    const content = logs
      .map((l) => `${l.timestamp ?? ""} ${l.pod_name ? `[${l.pod_name}] ` : ""}${l.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `logs-${logType}-${format(new Date(), "yyyyMMdd-HHmmss")}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            data-open={isDropdownOpen || undefined}
            aria-label="Log View Preferences"
            type="button"
            size="icon"
            variant="ghost"
            className={cn("touch-manipulation", className)}
          >
            <ActiveDot show={!isDefaultState} />
            <div className="relative size-5 transition-transform group-data-open/button:rotate-90">
              <SettingsIcon className="size-full opacity-100 transition-opacity group-data-open/button:opacity-0" />
              <XIcon className="absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-open/button:opacity-100" />
            </div>
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        collisionPadding={dropdownCollisionPadding}
        className="w-3xl sm:w-56"
      >
        <ScrollArea>
          {logViewPreferences.map((group, index) => (
            <div key={group.label} className="flex w-full flex-col">
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup title={group.label}>
                <DropdownMenuLabel className="pb-0">{group.label}</DropdownMenuLabel>
                {group.items
                  .filter(
                    (i) =>
                      i.value !== logViewPreferenceKeys.serviceId ||
                      logTypeCapabilities[logType].serviceColumn,
                  )
                  .map((item) =>
                    item.type === "checkbox" ? (
                      <DropdownMenuCheckboxItem
                        className={dropdownItemClassName}
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
                      <DropdownMenuItem className={dropdownItemClassName} key={item.value}>
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
              disabled={!hasLogs}
              onClick={downloadLogs}
              className={dropdownItemClassName}
            >
              <DownloadIcon className="-my-1 size-4.5 shrink-0" />
              <p className="min-w-0 shrink">Download Logs</p>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              data-not-default={!isDefaultState || undefined}
              disabled={isDefaultState}
              closeOnClick={false}
              onClick={() => {
                resetPreferences();
              }}
              className={cn(
                "group/item data-not-default:text-warning data-not-default:data-highlighted:bg-warning/10 data-not-default:active:bg-warning/10",
                dropdownItemClassName,
              )}
            >
              <RotateCcwIcon className="-my-1 size-4.5 shrink-0 -rotate-90 transform transition-transform group-data-not-default/item:rotate-0" />
              <p className="min-w-0 shrink">Reset</p>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default memo(SearchBar);
