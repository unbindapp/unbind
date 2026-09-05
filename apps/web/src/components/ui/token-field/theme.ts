import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// CodeMirror only takes clicks on .cm-content, so the editor is stretched to
// its host and the padding sits on the content: the whole bordered area places
// the cursor. Hosts set the padding through --token-field-content-padding.
export const tokenFieldTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "inherit",
    fontSize: "inherit",
    fontFamily: "inherit",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "inherit",
    overflow: "auto",
  },
  ".cm-content": {
    minHeight: "100%",
    padding: "var(--token-field-content-padding, 0.5rem 0.75rem)",
    caretColor: "var(--foreground)",
    cursor: "text",
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

// A long single-line value scrolls sideways; a text field shouldn't show a
// scrollbar for that.
export const tokenFieldSingleLineTheme = EditorView.theme({
  ".cm-scroller": { scrollbarWidth: "none" },
  ".cm-scroller::-webkit-scrollbar": { display: "none" },
});

export const tokenFieldMultilineTheme = EditorView.theme({
  ".cm-scroller": { scrollbarWidth: "thin" },
});

// Classes are defined in globals.css so the colors sit next to the Prism token
// rules the raw variable editor already uses. tok-key and tok-punct aren't here
// because they're applied by the languages' own decorations, not by a tag.
export const tokenFieldHighlightStyle = HighlightStyle.define([
  { tag: t.logicOperator, class: "tok-operator" },
  { tag: t.operator, class: "tok-negation" },
]);
