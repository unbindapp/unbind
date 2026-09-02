import {
  tokenFieldEditorClassName,
  tokenFieldWrapperClassName,
} from "@/components/ui/token-field/styles";
import type { TTokenFieldProps } from "@/components/ui/token-field/token-field";
import { cn } from "@/components/ui/utils";

/**
 * Stands in while the CodeMirror chunk loads. Typing here is not lost: the
 * value is controlled, so whatever is typed carries into the real editor.
 */
export default function TokenFieldFallback({
  value,
  onChange,
  onBlur,
  placeholder,
  multiline,
  ariaLabel,
  ariaInvalid,
  warning,
  disabled,
  trailing,
  className,
  classNameEditor,
}: TTokenFieldProps) {
  return (
    <div
      data-disabled={disabled || undefined}
      data-warning={warning || undefined}
      aria-invalid={ariaInvalid || undefined}
      className={cn(tokenFieldWrapperClassName, className)}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
        onBlur={onBlur}
        rows={1}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className={cn(
          tokenFieldEditorClassName,
          "placeholder:text-muted-foreground/75 resize-none bg-transparent outline-hidden",
          classNameEditor,
        )}
      />
      {trailing}
    </div>
  );
}
