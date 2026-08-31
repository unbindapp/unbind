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
  // which pushes the line one pixel taller than a line of plain text: the field
  // twitches the moment a placeholder or an inline icon appears. Centering the
  // buffer keeps it inside the line box, so it still does its job of giving the
  // cursor something to sit against.
  ".cm-widgetBuffer": { verticalAlign: "middle" },
  // Inline icons sit in a 1em box the artwork overflows, so a line with icons
  // is exactly as tall as one without and the field never grows as a value
  // resolves. They're decoration, not text: clicks fall through to the position
  // behind them.
  ".cm-token-icon": {
    display: "inline-flex",
    alignItems: "center",
    height: "1em",
    verticalAlign: "middle",
    marginRight: "0.2em",
    pointerEvents: "none",
  },
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
export const tokenFieldHighlightStyle = HighlightStyle.define([
  { tag: t.string, class: "tok-value" },
  { tag: t.logicOperator, class: "tok-operator" },
  { tag: t.operator, class: "tok-negation" },
]);
