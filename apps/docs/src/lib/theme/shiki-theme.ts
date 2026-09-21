import type { ThemeRegistration } from "shiki";

// Token rules need hex colors, so each role gets a placeholder that Shiki replaces with
// a CSS variable from apps/web tokens.css in the output. Code then follows the app in
// both modes and one theme serves light and dark.
const roles = {
  foreground: ["#000001", "var(--foreground)"],
  muted: ["#000002", "var(--muted-foreground)"],
  comment: ["#000003", "var(--muted-more-foreground)"],
  keyword: ["#000004", "var(--process)"],
  string: ["#000005", "var(--success)"],
  constant: ["#000006", "var(--change)"],
  type: ["#000007", "var(--warning)"],
  invalid: ["#000008", "var(--destructive)"],
} as const;

const color = (role: keyof typeof roles) => roles[role][0];

function createTheme(name: string, kind: "light" | "dark"): ThemeRegistration {
  return {
    name,
    type: kind,
    fg: roles.foreground[1],
    bg: "transparent",
    colors: { "editor.background": "transparent", "editor.foreground": roles.foreground[1] },
    colorReplacements: Object.fromEntries(Object.values(roles)),
    tokenColors: [
      { settings: { foreground: color("foreground") } },
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: color("comment") },
      },
      {
        scope: [
          "punctuation",
          "meta.brace",
          "meta.delimiter",
          "punctuation.definition.tag",
          "keyword.operator",
        ],
        settings: { foreground: color("muted") },
      },
      {
        scope: [
          "keyword",
          "storage",
          "storage.type",
          "storage.modifier",
          "keyword.control",
          "keyword.package",
          "keyword.function",
          "keyword.other",
          "entity.name.tag",
          "entity.name.command",
          "support.function.builtin",
          "keyword.other.special-method",
          "markup.heading",
        ],
        settings: { foreground: color("keyword") },
      },
      {
        scope: [
          "string",
          "string.quoted",
          "string.template",
          "punctuation.definition.string",
          "markup.inline.raw",
          "markup.fenced_code",
          "markup.inserted",
        ],
        settings: { foreground: color("string") },
      },
      {
        scope: [
          "constant",
          "constant.numeric",
          "constant.language",
          "constant.other.option",
          "support.constant",
          "variable.other.constant",
          "entity.other.attribute-name",
          "meta.object-literal.key",
          "meta.object.member",
          "support.type.property-name",
          "string.other.link",
        ],
        settings: { foreground: color("constant") },
      },
      {
        scope: [
          "entity.name.type",
          "entity.name.class",
          "entity.name.namespace",
          "support.type",
          "support.class",
          "entity.name.function",
          "support.function",
          "meta.function-call.generic",
          "markup.bold",
        ],
        settings: { foreground: color("type") },
      },
      {
        scope: [
          "string.unquoted.argument",
          "variable",
          "variable.parameter",
          "variable.other",
          "meta.definition.variable",
          "meta.object.member string",
        ],
        settings: { foreground: color("foreground") },
      },
      {
        scope: [
          "meta.object.member string.quoted",
          "meta.object.member punctuation.definition.string",
        ],
        settings: { foreground: color("string") },
      },
      {
        scope: ["invalid", "invalid.illegal", "markup.deleted"],
        settings: { foreground: color("invalid") },
      },
      { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
      { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    ],
  };
}

export const unbindLight = createTheme("unbind-light", "light");
export const unbindDark = createTheme("unbind-dark", "dark");
export const shikiThemes = { light: unbindLight, dark: unbindDark };
