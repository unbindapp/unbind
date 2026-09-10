import { useSettingsSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { SearchIcon, XIcon } from "lucide-react";
import { useRef } from "react";

export default function SettingsSearchBar({ className }: { className?: string }) {
  const { query, setQuery } = useSettingsSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = query !== "";

  const clear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative flex w-full items-stretch", className)}>
      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 z-1 flex w-8.25 items-center pl-2.75">
        <SearchIcon className="size-4" />
      </div>
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !hasValue) return;
          e.preventDefault();
          e.stopPropagation();
          clear();
        }}
        aria-label="Search settings"
        placeholder="Search settings"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className="pr-10 pl-8.5"
      />
      <div className="pointer-events-none absolute inset-y-px right-px flex w-10 overflow-hidden rounded-r-[7px]">
        <Button
          type="button"
          aria-label="Clear search"
          data-has-value={hasValue || undefined}
          disabled={!hasValue}
          onClick={clear}
          variant="ghost"
          className="text-muted-more-foreground pointer-events-auto h-full w-full translate-x-full rounded-none transition data-has-value:translate-x-0"
        >
          <XIcon className="size-4.5" />
        </Button>
      </div>
    </div>
  );
}
