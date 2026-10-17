import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { SearchIcon, XIcon } from "lucide-react";
import { useRef } from "react";

type TProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  className?: string;
  classNameInput?: string;
  classNameClearButton?: string;
};

export default function SearchInput({
  value,
  onValueChange,
  placeholder,
  className,
  classNameInput,
  classNameClearButton,
}: TProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value !== "";

  const clear = () => {
    onValueChange("");
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative flex w-full items-stretch", className)}>
      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 z-1 flex w-8.25 items-center pl-2.75">
        <SearchIcon className="size-4" />
      </div>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !hasValue) return;
          e.preventDefault();
          e.stopPropagation();
          clear();
        }}
        aria-label={placeholder}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className={cn("pr-10 pl-8.5", classNameInput)}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center overflow-hidden p-1">
        <Button
          type="button"
          aria-label="Clear search"
          data-has-value={hasValue || undefined}
          disabled={!hasValue}
          onClick={clear}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground pointer-events-auto size-8.5 translate-x-[calc(100%+0.25rem)] rounded-sm transition data-has-value:translate-x-0",
            classNameClearButton,
          )}
        >
          <XIcon className="size-4.5" />
        </Button>
      </div>
    </div>
  );
}
