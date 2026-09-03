import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Padding lives on the wrapper, not on .cm-content, so long values scroll
// beside the field's icons and buttons instead of underneath them.
export const tokenFieldTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "inherit",
    fontSize: "inherit",
    fontFamily: "inherit",
  },
  "&.cm-focused": { outline: "none" },
  // The scroller overflows horizontally on a long single line; a text field
  // shouldn't show a scrollbar for that.
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "inherit",
    alignItems: "flex-start",
    scrollbarWidth: "none",
  },
  ".cm-scroller::-webkit-scrollbar": { display: "none" },
  ".cm-content": {
    padding: "0",
    caretColor: "var(--foreground)",
    minHeight: "auto",
  },
  ".cm-line": { padding: "0" },
  // CodeMirror puts a 1em, text-top aligned buffer <img> beside every widget,
  // which makes the placeholder's line one pixel taller than a line of text and
  // shows up as the field twitching on first keystroke. The placeholder is the
  // only widget these fields use, and it needs no cursor affordance, so drop it
  // there only.
  ".cm-line:has(.cm-placeholder) .cm-widgetBuffer": { display: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-placeholder": {
    color: "color-mix(in oklab, var(--muted-foreground) 75%, transparent)",
    fontWeight: "500",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in oklab, var(--top-loader) 50%, transparent)",
  },
});

// Classes are defined in globals.css so the colors sit next to the Prism token
// rules the raw variable editor already uses. tok-key and tok-punct aren't here
// because they're applied by the languages' own decorations, not by a tag.
// For editors that fill their host: CodeMirror only takes clicks on
// .cm-content, so the padding moves onto it and the editor is stretched to the
// host, letting the whole bordered area place the cursor. The scrollbar comes
// back since the editor, not the host, scrolls.
// Selectors carry an extra class so these win over tokenFieldTheme's rules of
// the same shape.
export const tokenFieldFillTheme = EditorView.theme({
  "&.cm-editor": { height: "100%" },
  "&.cm-editor .cm-scroller": {
    overflow: "auto",
    scrollbarWidth: "thin",
  },
  "&.cm-editor .cm-scroller::-webkit-scrollbar": { display: "initial" },
  "&.cm-editor .cm-content": {
    minHeight: "100%",
    padding: "var(--token-field-content-padding, 0)",
    cursor: "text",
  },
});

export const tokenFieldHighlightStyle = HighlightStyle.define([
  { tag: t.logicOperator, class: "tok-operator" },
  { tag: t.operator, class: "tok-negation" },
]);
