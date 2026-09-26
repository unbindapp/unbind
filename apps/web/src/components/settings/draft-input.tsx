import ErrorLine from "@/components/error-line";
import { MiniSection } from "@/components/settings/mini-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { ComponentProps, FC, useRef } from "react";

type TProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  // What cancel goes back to: the staged value, or the one revert goes back to
  baseline: string;
  // The value revert brings back, usually the server's
  revertTo: string;
  getError: (value: string) => string | null;
  onConfirm: (value: string) => void;
  onRevert: () => void;
  Icon: FC<{ className?: string }>;
  placeholder?: string;
  inputMode?: ComponentProps<"input">["inputMode"];
  unit?: string;
  disabled?: boolean;
  disabledText?: string;
};

// Typing is a draft: it gets a cancel and a confirm button, and only a confirmed value
// is staged. The field shows as changed only while the confirmed value differs from the
// one revert brings back.
export function DraftInput({
  value,
  onChange,
  onBlur,
  baseline,
  revertTo,
  getError,
  onConfirm,
  onRevert,
  Icon,
  placeholder,
  inputMode,
  unit,
  disabled = false,
  disabledText,
}: TProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraft = value !== baseline;
  const draftError = isDraft ? getError(value) : null;
  const isStaged = baseline !== revertTo;
  const showRevert = !disabled && !isDraft && isStaged;
  const showDraftButtons = !disabled && isDraft;

  const cancel = () => {
    onChange(baseline);
    inputRef.current?.focus();
  };
  const confirm = () => {
    if (draftError) return;
    onConfirm(value);
  };

  const input = (
    <div className="relative min-w-0 flex-1">
      <Icon
        className={cn(
          "pointer-events-none absolute top-3 left-3.25 size-4.5",
          isStaged && "text-change",
          disabled && "opacity-50",
        )}
      />
      <Input
        ref={inputRef}
        value={disabled ? (disabledText ?? value) : value}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!isDraft) return;
          if (e.key === "Enter") {
            e.preventDefault();
            confirm();
            return;
          }
          if (e.key !== "Escape") return;
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={draftError !== null || undefined}
        className={cn(
          "w-full pl-9.5",
          showDraftButtons && "pr-20",
          showRevert && "pr-11.5",
          unit && "rounded-r-none",
        )}
        disabled={disabled}
        hasChanges={isStaged}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="pointer-events-none absolute top-0 right-0 flex h-full items-center justify-end overflow-hidden pr-0.75">
        <div
          data-visible={showDraftButtons || showRevert || undefined}
          className="flex translate-x-full items-center transition data-visible:translate-x-0"
        >
          {showDraftButtons ? (
            <>
              <Button
                type="button"
                aria-label="Cancel"
                onClick={cancel}
                variant="ghost"
                size="icon"
                className="pointer-events-auto rounded-md"
              >
                <XIcon className="size-4.5" />
              </Button>
              <Button
                type="button"
                aria-label="Confirm"
                disabled={draftError !== null}
                onClick={confirm}
                variant="ghost-success"
                size="icon"
                className="pointer-events-auto rounded-md"
              >
                <CheckIcon className="size-4.5" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              aria-label="Revert"
              disabled={!showRevert}
              onClick={onRevert}
              variant={isStaged ? "ghost-change" : "ghost"}
              data-staged={isStaged || undefined}
              size="icon"
              className="pointer-events-auto rounded-md"
            >
              <RotateCcwIcon className="size-4.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex w-full flex-col">
      {unit ? (
        <MiniSection unit={unit} hasChanges={isStaged}>
          {input}
        </MiniSection>
      ) : (
        input
      )}
      {draftError && <ErrorLine className="bg-transparent py-1.5 pl-1.5" message={draftError} />}
    </div>
  );
}
