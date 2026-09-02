import {
  logLevels,
  logTypeCapabilities,
  useLogFilters,
} from "@/components/logs/log-filters-provider";
import {
  activeLogRangePreset,
  logRangePresets,
  type TLogRangePreset,
} from "@/components/logs/log-range";
import { useLogViewDropdown } from "@/components/logs/log-view-dropdown-provider";
import {
  createLogSearchLanguage,
  levelIconKey,
  type TLogSearchData,
} from "@/components/logs/log-search-language";
import { logSearchScopes } from "@/components/logs/log-search-scope";
import { useLogs } from "@/components/logs/logs-provider";
import {
  logViewPreferenceKeys,
  logViewPreferences,
  useLogViewPreferences,
} from "@/components/logs/log-view-preferences-provider";
import { buildServiceTokens, toServiceToken } from "@/components/logs/service-tokens";
import BrandIcon from "@/components/icons/brand";
import { IconCache, type TCachedIcon } from "@/components/icons/icon-cache";
import { iconCompletionAddition } from "@/components/ui/token-field/icon-completion";
import type { TBufferedLogLine } from "@/components/logs/logs-provider";
import ServiceIcon from "@/components/service/service-icon";
import { useServices } from "@/components/service/services-provider";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import TokenField, { type TTokenFieldHandle } from "@/components/ui/token-field/token-field";
import { cn } from "@/components/ui/utils";
import { defaultDebounceMs } from "@/lib/constants";
import { TLogLevel, TLogType } from "@/lib/queries/logs";
import { format } from "date-fns";
import {
  BugIcon,
  CircleAlertIcon,
  DownloadIcon,
  FilterIcon,
  InfoIcon,
  LoaderIcon,
  RotateCcwIcon,
  SearchIcon,
  ServerIcon,
  SettingsIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type FC } from "react";
import { useDebouncedCallback } from "use-debounce";

type TProps = {
  isPendingLogs: boolean;
  logType: TLogType;
  searchError: string | null;
  hasLogs: boolean;
  getLogsForDownload: () => TBufferedLogLine[] | null;
  className?: string;
};

const completionAdditions = [iconCompletionAddition];

const levelIcons: Record<TLogLevel, FC<{ className?: string }>> = {
  debug: BugIcon,
  info: InfoIcon,
  warning: CircleAlertIcon,
  error: TriangleAlertIcon,
};

const levelIconClassName = "size-4 shrink-0";

// The option's own class carries the color, and the icons stroke with
// currentColor, so both stay in step.
const levelIconNodes: TCachedIcon[] = logLevels.map((level) => {
  const Icon = levelIcons[level];
  return { key: levelIconKey(level), node: <Icon className={levelIconClassName} /> };
});

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
  const { searchText, commitSearch } = useLogFilters();
  const scope = logSearchScopes[logType];
  const [inputValue, setInputValue] = useState(searchText);
  const inputRef = useRef<TTokenFieldHandle>(null);

  const {
    query: { data: servicesData },
  } = useServices();

  const serviceIconsById = useMemo(() => {
    const icons = new Map<string, string>();
    for (const service of servicesData?.services ?? []) icons.set(service.id, service.config.icon);
    return icons;
  }, [servicesData]);

  // Read through a ref so the editor isn't recreated as services load; the
  // language memo below is what asks it to redraw.
  const searchDataRef = useRef<TLogSearchData>({
    levels: logLevels,
    services: undefined,
    attributeKeys: scope.attributeKeys,
  });
  searchDataRef.current = {
    levels: logLevels,
    services: servicesData
      ? buildServiceTokens(servicesData.services).map((s) => ({
          token: s.token,
          // only worth showing when characters were rewritten ("Web App" ->
          // "Web-App"); a uniqueness suffix speaks for itself
          detail: toServiceToken(s.name) === s.name ? undefined : s.name,
          brand: serviceIconsById.get(s.id),
        }))
      : undefined,
    attributeKeys: scope.attributeKeys,
  };

  const icons: TCachedIcon[] = useMemo(
    () => [
      ...levelIconNodes,
      ...[...new Set(serviceIconsById.values())].map((brand) => ({
        key: brand,
        node: <BrandIcon color="brand" brand={brand} className="size-4 shrink-0" />,
      })),
    ],
    [serviceIconsById],
  );
  // The highlighter reads its data through the ref, so a new language is the
  // only thing that makes the field reconfigure and redraw. Rebuilding it when
  // the services change is what settles a @service chip that was already in the
  // field when the list loaded.
  const language = useMemo(
    () => createLogSearchLanguage(() => searchDataRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [servicesData],
  );

  // A commit extracts the tokens into the filter params and reports the
  // canonical text those params render back to; remembering it is what tells
  // a later param change apart from an echo of our own write.
  const lastSyncedSearch = useRef(searchText);
  const debouncedCommit = useDebouncedCallback((value: string) => {
    lastSyncedSearch.current = commitSearch(value);
  }, defaultDebounceMs);

  // adopt external changes (filter menu, back/forward, shared links, reset) and
  // drop any pending debounced write so it can't resurrect a filter the user
  // cleared
  useEffect(() => {
    if (searchText === lastSyncedSearch.current) return;
    debouncedCommit.cancel();
    lastSyncedSearch.current = searchText;
    setInputValue(searchText);
  }, [searchText, debouncedCommit]);

  const onClearInput = () => {
    debouncedCommit.cancel();
    setInputValue("");
    lastSyncedSearch.current = commitSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="flex w-full items-stretch gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            debouncedCommit.flush();
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
          <IconCache icons={icons} />
          <TokenField
            ref={inputRef}
            value={inputValue}
            language={language}
            onSubmit={() => debouncedCommit.flush()}
            onChange={(value) => {
              setInputValue(value);
              if (!value) {
                debouncedCommit.cancel();
                lastSyncedSearch.current = commitSearch("");
                return;
              }
              debouncedCommit(value);
            }}
            completionAdditions={completionAdditions}
            ariaLabel="Search logs"
            ariaInvalid={searchError ? true : undefined}
            className="flex-1"
            classNameEditor="py-1.75 pr-31 pl-8.5"
            placeholder={scope.placeholder}
          />
          <div className="absolute top-0 right-0 flex h-full justify-end">
            <Button
              data-has-value={(inputValue !== undefined && inputValue !== "") || undefined}
              disabled={inputValue === "" || inputValue === undefined}
              onClick={onClearInput}
              variant="ghost"
              className="text-muted-more-foreground relative z-0 h-full w-10 translate-x-10 rounded-none transition data-has-value:translate-x-0"
            >
              <XIcon className="size-4.5" />
            </Button>
            <FilterButton className="bg-input z-1 border-t border-b" />
            <SettingsButton
              logType={logType}
              hasLogs={hasLogs}
              getLogsForDownload={getLogsForDownload}
              className="bg-input group/button relative z-1 h-auto w-10 rounded-l-none rounded-r-lg border-t border-r border-b border-l"
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

function FilterButton({ className }: { className?: string }) {
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
    servicesEnabled,
  } = useLogFilters();

  const isNotDefaultState = levels.length > 0 || serviceIds.length > 0 || rangeIsSet;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            data-open={isDropdownOpen || undefined}
            data-non-default={isNotDefaultState || undefined}
            aria-label="Filter Logs"
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "relative h-auto w-10 touch-manipulation rounded-none border-l",
              className,
            )}
          >
            <div className="group-data-non-default/button:text-warning relative size-5 transition-transform group-data-open/button:rotate-45">
              <FilterIcon className="size-full opacity-100 group-data-open/button:opacity-0" />
              <XIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-data-open/button:opacity-100" />
            </div>
            <NonDefaultIndicator isNotDefaultState={isNotDefaultState} />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        collisionPadding={dropdownCollisionPadding}
        className="max-h-[calc(var(--available-height)-4rem)] w-3xl sm:max-h-[min(45rem,calc(var(--available-height)-4rem))] sm:w-80"
      >
        <ScrollArea className="min-h-0 shrink">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Levels</DropdownMenuLabel>
            {logLevels.map((level) => {
              const Icon = levelIcons[level];
              return (
                <DropdownMenuCheckboxItem
                  key={level}
                  className={filterCheckboxItemClassName}
                  checked={levels.includes(level)}
                  onCheckedChange={(checked) =>
                    setLevels(checked ? [...levels, level] : levels.filter((l) => l !== level))
                  }
                >
                  <div
                    data-level={level}
                    className="data-[level=error]:text-destructive data-[level=warning]:text-warning flex min-w-0 shrink items-center gap-2"
                  >
                    <Icon className={levelIconClassName} />
                    <p className="min-w-0 shrink">{levelLabels[level]}</p>
                  </div>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
          {servicesEnabled && (
            <ServicesFilterGroup serviceIds={serviceIds} setServiceIds={setServiceIds} />
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup className="pb-2">
            <DropdownMenuLabel>Time Range</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeLogRangePreset(range)}
              onValueChange={(preset: TLogRangePreset) => setRange({ preset, until: range.until })}
              className="grid w-full grid-cols-4 gap-1.5 px-1.5 pt-1.5"
            >
              {logRangePresets.map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant="outline"
                  render={<DropdownMenuRadioItem hideIndicator value={preset} />}
                  className="data-checked:border-foreground text-muted-foreground data-checked:text-foreground data-highlighted:bg-border data-highlighted:text-foreground w-full justify-center px-2 py-1.5 font-mono font-semibold"
                >
                  {preset}
                </Button>
              ))}
            </DropdownMenuRadioGroup>
            <div
              onKeyDown={(e) => {
                if (e.key === "Escape") return;
                e.stopPropagation();
              }}
              className="w-full px-1.5 pt-1.5 pb-1.5"
            >
              <CustomRangeInputs className="pt-1.5" />
            </div>
          </DropdownMenuGroup>
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
            <p className="min-w-0 shrink">Clear Filters</p>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NonDefaultIndicator({ isNotDefaultState }: { isNotDefaultState: boolean }) {
  return (
    <div
      data-non-default={isNotDefaultState || undefined}
      className="bg-warning absolute top-1 right-1 h-1.5 w-1.5 scale-50 rounded-full opacity-0 transition-[scale,opacity] data-non-default:scale-100 data-non-default:opacity-100"
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
            <div className="flex min-w-0 shrink items-center gap-2">
              <ServiceIcon service={service} className="size-4.5 shrink-0" />
              <p className="min-w-0 truncate">{service.name}</p>
            </div>
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
  const { mode } = useLogs();

  const [fromValue, setFromValue] = useState(toDatetimeLocal(range.from));
  const [untilValue, setUntilValue] = useState(toDatetimeLocal(range.until));
  const [error, setError] = useState<string | null>(null);

  // follow external range changes (presets, reset, view-in-context)
  const lastApplied = useRef({ from: range.from, until: range.until });
  useEffect(() => {
    if (range.from === lastApplied.current.from && range.until === lastApplied.current.until) {
      return;
    }
    lastApplied.current = { from: range.from, until: range.until };
    setFromValue(toDatetimeLocal(range.from));
    setUntilValue(toDatetimeLocal(range.until));
    setError(null);
  }, [range.from, range.until]);

  const apply = (from: string, until: string) => {
    setFromValue(from);
    setUntilValue(until);

    const fromMs = from ? new Date(from).getTime() : undefined;
    const untilMs = until ? new Date(until).getTime() : undefined;
    if (fromMs !== undefined && !Number.isFinite(fromMs)) return;
    if (untilMs !== undefined && !Number.isFinite(untilMs)) return;
    if (fromMs !== undefined && untilMs !== undefined && untilMs <= fromMs) {
      setError("Until must be after from.");
      return;
    }

    setError(null);
    lastApplied.current = { from: fromMs, until: untilMs };
    if (fromMs === undefined && untilMs === undefined) {
      setRange(null);
      return;
    }
    setRange({ preset: range.preset, from: fromMs, until: untilMs });
  };

  const hint = error
    ? error
    : mode === "historical"
      ? "Historical data, not live."
      : range.from !== undefined
        ? "Live from the start time."
        : null;

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div className="flex w-full flex-col gap-1.5">
        <label className="flex w-full items-center gap-4">
          <span className="text-muted-foreground w-12 shrink-0 px-1 text-sm font-medium">From</span>
          <Input
            type="datetime-local"
            tabIndex={-1}
            aria-label="From"
            value={fromValue}
            onChange={(e) => apply(e.target.value, untilValue)}
            className="bg-background w-full min-w-0 appearance-none px-2.5 py-2"
          />
        </label>
        <label className="flex w-full items-center gap-4">
          <span className="text-muted-foreground w-12 shrink-0 px-1 text-sm font-medium">
            Until
          </span>
          <Input
            type="datetime-local"
            tabIndex={-1}
            aria-label="Until"
            value={untilValue}
            onChange={(e) => apply(fromValue, e.target.value)}
            className="bg-background w-full min-w-0 appearance-none px-2.5 py-2"
          />
        </label>
      </div>
      {hint && (
        <p
          data-error={error ? true : undefined}
          className="text-muted-foreground data-error:text-destructive px-1.75 pt-0.5 text-right text-sm leading-tight"
        >
          {hint}
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
            data-non-default={!isDefaultState || undefined}
            data-open={isDropdownOpen || undefined}
            aria-label="Log View Preferences"
            type="button"
            size="icon"
            variant="ghost"
            className={cn("touch-manipulation", className)}
          >
            <div className="group-data-non-default/button:text-warning relative size-5 transition-transform group-data-open/button:rotate-45">
              <SettingsIcon className="size-full opacity-100 group-data-open/button:opacity-0" />
              <XIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-data-open/button:opacity-100" />
            </div>
            <NonDefaultIndicator isNotDefaultState={!isDefaultState} />
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
