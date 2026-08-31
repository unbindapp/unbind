// Shared between the editor and its loading fallback so the two are pixel
// identical while the CodeMirror chunk is still in flight. Keep free of
// CodeMirror imports.
export const tokenFieldWrapperClassName =
  "bg-input focus-within:ring-primary/50 aria-invalid:border-destructive flex w-full rounded-lg border text-left transition-colors focus-within:ring-1 data-disabled:cursor-not-allowed data-disabled:opacity-50";

// The leading has to clear a chip's fill, which is the font's ascent-to-descent
// band rather than the text height; tighter and the field clips the top of it.
// The padding gives back what the leading takes so the field keeps its height.
export const tokenFieldEditorClassName = "w-0 min-w-0 flex-1 px-3 py-2 leading-normal font-medium";
