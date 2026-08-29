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
// rules the raw variable editor already uses.
export const tokenFieldHighlightStyle = HighlightStyle.define([
  { tag: t.propertyName, class: "tok-key" },
  { tag: t.punctuation, class: "tok-punct" },
  { tag: t.string, class: "tok-value" },
  { tag: t.logicOperator, class: "tok-operator" },
  { tag: t.operator, class: "tok-negation" },
  { tag: t.invalid, class: "tok-invalid" },
]);
