import type { ThemeRegistration } from "shiki";

// Colors are CSS variables from apps/web tokens.css, so code follows the app in
// both modes and one theme serves light and dark.
const foreground = "var(--foreground)";
const muted = "var(--muted-foreground)";
const comment = "var(--muted-more-foreground)";
const keyword = "var(--process)";
const string = "var(--success)";
const constant = "var(--change)";
const type = "var(--warning)";
const invalid = "var(--destructive)";

function createTheme(name: string, kind: "light" | "dark"): ThemeRegistration {
  return {
    name,
    type: kind,
    colors: { "editor.background": "transparent", "editor.foreground": foreground },
    settings: [{ settings: { foreground } }],
    tokenColors: [
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: comment } },
      {
        scope: ["punctuation", "meta.brace", "meta.delimiter", "punctuation.definition.tag"],
        settings: { foreground: muted },
      },
      {
        scope: [
          "keyword",
          "storage",
          "storage.type",
          "keyword.operator",
          "keyword.control",
          "entity.name.tag",
          "support.function.builtin.shell",
          "markup.heading",
        ],
        settings: { foreground: keyword },
      },
      {
        scope: [
          "string",
          "string.quoted",
          "string.template",
          "punctuation.definition.string",
          "markup.inline.raw",
          "markup.fenced_code",
        ],
        settings: { foreground: string },
      },
      {
        scope: [
          "constant",
          "constant.numeric",
          "constant.language",
          "support.constant",
          "variable.other.constant",
          "entity.other.attribute-name",
          "meta.object-literal.key",
          "support.type.property-name",
          "string.other.link",
        ],
        settings: { foreground: constant },
      },
      {
        scope: [
          "entity.name.type",
          "entity.name.class",
          "support.type",
          "support.class",
          "entity.name.function",
          "support.function",
          "meta.function-call.generic",
          "markup.bold",
        ],
        settings: { foreground: type },
      },
      {
        scope: ["variable", "variable.parameter", "variable.other", "meta.definition.variable"],
        settings: { foreground },
      },
      {
        scope: ["invalid", "invalid.illegal", "markup.deleted"],
        settings: { foreground: invalid },
      },
      { scope: ["markup.inserted"], settings: { foreground: string } },
      { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
      { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    ],
  };
}

export const unbindLight = createTheme("unbind-light", "light");
export const unbindDark = createTheme("unbind-dark", "dark");
export const shikiThemes = { light: unbindLight, dark: unbindDark };
